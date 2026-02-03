"""
Dust.zip - ZeroDust EIP-7702 Dust Aggregator
Allows 100% balance transfers without leaving dust behind
Sponsor pays gas, charges gas cost + 20% buffer + 5% service fee
"""

import os
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3
from eth_account import Account
from eth_account.signers.local import LocalAccount

app = Flask(__name__)
CORS(app)

# Configuration
RPC_TIMEOUT = 5
GAS_PRICE_MULTIPLIER = 1.2  # 20% buffer on gas
SERVICE_FEE_PERCENTAGE = 0.05  # 5%
MIN_SERVICE_FEE_USD = 0.05
MAX_SERVICE_FEE_USD = 0.50

# Sponsor configuration (the address that pays for gas)
SPONSOR_ADDRESS = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"

# EIP-7702 Delegate Call Contract Address (same on all chains)
# This contract allows the sponsor to execute transactions on behalf of the user
EIP7702_DELEGATE_CONTRACT = "0x0000000000000000000000000000000000008001"

# ZeroDust Contract Addresses (same on all chains)
ZERODUST_CONTRACT = "0x4242424242424242424242424242424242424242"  # Placeholder - to be deployed

# 15 Supported EVM Chains with RPC URLs
CHAINS = {
    "ethereum": {
        "name": "Ethereum",
        "rpc": "https://eth.llamarpc.com",
        "chain_id": 1,
        "symbol": "ETH",
        "color": "#627EEA",
        "explorer": "https://etherscan.io/tx/"
    },
    "polygon": {
        "name": "Polygon",
        "rpc": "https://polygon-rpc.com",
        "chain_id": 137,
        "symbol": "MATIC",
        "color": "#8247E5",
        "explorer": "https://polygonscan.com/tx/"
    },
    "bsc": {
        "name": "BNB Chain",
        "rpc": "https://bsc-dataseed.binance.org",
        "chain_id": 56,
        "symbol": "BNB",
        "color": "#F3BA2F",
        "explorer": "https://bscscan.com/tx/"
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": "https://arb1.arbitrum.io/rpc",
        "chain_id": 42161,
        "symbol": "ETH",
        "color": "#28A0F0",
        "explorer": "https://arbiscan.io/tx/"
    },
    "optimism": {
        "name": "Optimism",
        "rpc": "https://mainnet.optimism.io",
        "chain_id": 10,
        "symbol": "ETH",
        "color": "#FF0420",
        "explorer": "https://optimistic.etherscan.io/tx/"
    },
    "avalanche": {
        "name": "Avalanche",
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
        "chain_id": 43114,
        "symbol": "AVAX",
        "color": "#E84142",
        "explorer": "https://snowtrace.io/tx/"
    },
    "fantom": {
        "name": "Fantom",
        "rpc": "https://rpc.ftm.tools",
        "chain_id": 250,
        "symbol": "FTM",
        "color": "#1969FF",
        "explorer": "https://ftmscan.com/tx/"
    },
    "base": {
        "name": "Base",
        "rpc": "https://mainnet.base.org",
        "chain_id": 8453,
        "symbol": "ETH",
        "color": "#0052FF",
        "explorer": "https://basescan.org/tx/"
    },
    "linea": {
        "name": "Linea",
        "rpc": "https://rpc.linea.build",
        "chain_id": 59144,
        "symbol": "ETH",
        "color": "#61DFFF",
        "explorer": "https://lineascan.build/tx/"
    },
    "scroll": {
        "name": "Scroll",
        "rpc": "https://rpc.scroll.io",
        "chain_id": 534352,
        "symbol": "ETH",
        "color": "#FFDBB0",
        "explorer": "https://scrollscan.com/tx/"
    },
    "zksync": {
        "name": "zkSync Era",
        "rpc": "https://mainnet.era.zksync.io",
        "chain_id": 324,
        "symbol": "ETH",
        "color": "#8C8DFC",
        "explorer": "https://explorer.zksync.io/tx/"
    },
    "moonbeam": {
        "name": "Moonbeam",
        "rpc": "https://rpc.api.moonbeam.network",
        "chain_id": 1284,
        "symbol": "GLMR",
        "color": "#53CBC8",
        "explorer": "https://moonscan.io/tx/"
    },
    "celo": {
        "name": "Celo",
        "rpc": "https://forno.celo.org",
        "chain_id": 42220,
        "symbol": "CELO",
        "color": "#FCFF52",
        "explorer": "https://celoscan.io/tx/"
    },
    "gnosis": {
        "name": "Gnosis",
        "rpc": "https://rpc.gnosischain.com",
        "chain_id": 100,
        "symbol": "xDAI",
        "color": "#04795B",
        "explorer": "https://gnosisscan.io/tx/"
    },
    "aurora": {
        "name": "Aurora",
        "rpc": "https://mainnet.aurora.dev",
        "chain_id": 1313161554,
        "symbol": "ETH",
        "color": "#70D44B",
        "explorer": "https://aurorascan.dev/tx/"
    }
}

# Token prices in USD (simplified - in production use CoinGecko API)
TOKEN_PRICES = {
    "ETH": 3500,
    "MATIC": 0.75,
    "BNB": 650,
    "AVAX": 40,
    "FTM": 0.7,
    "GLMR": 0.2,
    "CELO": 0.5,
    "xDAI": 1.0
}


def get_token_price(symbol):
    """Get token price in USD (simplified)"""
    return TOKEN_PRICES.get(symbol, 3500)  # Default to ETH price


def get_balance_for_chain(key, chain, address):
    """Get balance for a single chain"""
    result = {
        "key": key,
        "name": chain['name'],
        "chain_id": chain['chain_id'],
        "symbol": chain['symbol'],
        "color": chain['color'],
        "explorer": chain['explorer'],
        "balance": 0.0,
        "balance_wei": "0",
        "balance_usd": 0.0
    }
    
    try:
        w3 = Web3(Web3.HTTPProvider(
            chain['rpc'],
            request_kwargs={'timeout': RPC_TIMEOUT}
        ))
        
        if w3.is_connected():
            bal_wei = w3.eth.get_balance(address)
            bal_eth = float(w3.from_wei(bal_wei, 'ether'))
            price = get_token_price(chain['symbol'])
            
            result['balance'] = bal_eth
            result['balance_wei'] = str(bal_wei)
            result['balance_usd'] = bal_eth * price
    except Exception as e:
        result['error'] = str(e)[:30]
    
    return result


def estimate_gas_costs(chain_key, balance_wei, to_address):
    """Estimate gas costs for EIP-7702 sponsored transaction"""
    try:
        chain = CHAINS[chain_key]
        w3 = Web3(Web3.HTTPProvider(
            chain['rpc'],
            request_kwargs={'timeout': 10}
        ))
        
        if not w3.is_connected():
            return None
        
        # Get current gas price
        gas_price = w3.eth.gas_price
        
        # Estimate gas for EIP-7702 sweep transaction
        # This is a simplified estimate - real implementation would simulate the transaction
        estimated_gas = 100000  # 100k gas is a safe estimate for EIP-7702 sweep
        
        # Calculate gas cost with 20% buffer
        gas_cost_wei = int(gas_price * estimated_gas * GAS_PRICE_MULTIPLIER)
        
        return {
            "gas_price": gas_price,
            "estimated_gas": estimated_gas,
            "gas_cost_wei": gas_cost_wei,
            "gas_cost_eth": float(w3.from_wei(gas_cost_wei, 'ether'))
        }
        
    except Exception as e:
        return None


def calculate_service_fee(amount_usd):
    """Calculate service fee: 5% with min $0.05 and max $0.50"""
    fee = amount_usd * SERVICE_FEE_PERCENTAGE
    fee = max(fee, MIN_SERVICE_FEE_USD)
    fee = min(fee, MAX_SERVICE_FEE_USD)
    return fee


def prepare_eip7702_sweep(chain_key, from_address, to_address, balance_wei, gas_cost_wei, service_fee_wei):
    """Prepare EIP-7702 sponsored sweep transaction"""
    try:
        chain = CHAINS[chain_key]
        
        # Calculate net amount to transfer
        # User pays: gas cost + service fee from their balance
        total_deduction = gas_cost_wei + service_fee_wei
        net_amount = balance_wei - total_deduction
        
        if net_amount <= 0:
            return {"error": "Insufficient balance after fees"}
        
        # EIP-7702 transaction structure
        # Sponsor calls delegate contract which transfers user's balance
        transaction = {
            "from": SPONSOR_ADDRESS,  # Sponsor pays gas
            "to": to_address,         # Destination address
            "value": str(net_amount),  # Net amount to transfer
            "gas": 200000,             # Gas limit
            "gasPrice": 0,             # Sponsor uses EIP-1559
            "nonce": 0,                # To be filled by sponsor
            "data": "0x",             # No calldata needed
            "chainId": chain['chain_id']
        }
        
        return {
            "transaction": transaction,
            "net_amount_wei": net_amount,
            "net_amount_eth": net_amount / 1e18,
            "gas_cost_wei": gas_cost_wei,
            "service_fee_wei": service_fee_wei,
            "total_fees_wei": total_deduction,
            "sponsor": SPONSOR_ADDRESS,
            "type": "eip7702_sponsored_sweep"
        }
        
    except Exception as e:
        return {"error": str(e)}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/chains')
def get_chains():
    return jsonify(CHAINS)


@app.route('/api/balances', methods=['POST'])
def get_balances():
    """Scan balances across chains"""
    try:
        data = request.get_json() or {}
        address = data.get('address', '')
        selected = data.get('chains', list(CHAINS.keys()))
        
        if not address or len(address) != 42:
            return jsonify({"error": "Invalid address"}), 400
        
        try:
            address = Web3.to_checksum_address(address)
        except:
            return jsonify({"error": "Invalid address format"}), 400
        
        results = []
        total_usd = 0.0
        
        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = {}
            
            for key in selected:
                if key in CHAINS:
                    chain = CHAINS[key]
                    future = executor.submit(get_balance_for_chain, key, chain, address)
                    futures[future] = key
            
            for future in as_completed(futures, timeout=30):
                try:
                    result = future.result()
                    results.append(result)
                    total_usd += result.get('balance_usd', 0)
                except:
                    pass
        
        results.sort(key=lambda x: x.get('balance_usd', 0), reverse=True)
        
        return jsonify({
            "address": address,
            "balances": results,
            "total_usd": round(total_usd, 2)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/estimate', methods=['POST'])
def estimate_sweep():
    """Estimate costs for EIP-7702 sponsored sweep"""
    try:
        data = request.get_json() or {}
        balances = data.get('balances', [])
        from_address = data.get('from_address', '')
        to_address = data.get('to_address', '')
        dest_chain_key = data.get('destination_chain', 'ethereum')
        
        # Validate addresses
        if not from_address or len(from_address) != 42:
            return jsonify({"error": "Invalid from address"}), 400
        if not to_address or len(to_address) != 42:
            return jsonify({"error": "Invalid to address"}), 400
        if dest_chain_key not in CHAINS:
            return jsonify({"error": "Invalid destination chain"}), 400
        
        dest_chain = CHAINS[dest_chain_key]
        
        estimates = []
        total_transfer_usd = 0.0
        total_gas_cost_usd = 0.0
        total_service_fee_usd = 0.0
        
        for bal in balances:
            balance_wei = int(bal.get('balance_wei', '0') or '0')
            chain_key = bal.get('key', '')
            balance_usd = bal.get('balance_usd', 0)
            
            # Skip low balances
            if balance_wei < 10000000000000:  # Less than 0.00001 ETH
                continue
            
            if chain_key == dest_chain_key:
                # Same chain - no gas cost needed
                gas_cost_wei = 0
                gas_cost_usd = 0
            else:
                # Different chain - estimate gas
                gas_info = estimate_gas_costs(chain_key, balance_wei, to_address)
                if not gas_info:
                    continue
                
                gas_cost_wei = gas_info['gas_cost_wei']
                gas_cost_usd = gas_info['gas_cost_eth'] * get_token_price(CHAINS[chain_key]['symbol'])
            
            # Calculate service fee (5%, min $0.05, max $0.50)
            service_fee_usd = calculate_service_fee(balance_usd - gas_cost_usd)
            service_fee_wei = int(service_fee_usd * 1e18 / get_token_price(dest_chain['symbol']))
            
            # Calculate net transfer
            net_usd = balance_usd - gas_cost_usd - service_fee_usd
            net_wei = int(balance_wei * max(0, net_usd / balance_usd)) if balance_wei > 0 else 0
            
            if net_usd > 0:
                estimates.append({
                    "chain_key": chain_key,
                    "chain_name": bal['name'],
                    "chain_id": bal['chain_id'],
                    "from_chain": bal['name'],
                    "to_chain": dest_chain['name'],
                    "balance_wei": balance_wei,
                    "balance_eth": bal['balance'],
                    "balance_usd": balance_usd,
                    "gas_cost_wei": gas_cost_wei,
                    "gas_cost_eth": gas_cost_wei / 1e18,
                    "gas_cost_usd": gas_cost_usd,
                    "service_fee_usd": service_fee_usd,
                    "service_fee_wei": service_fee_wei,
                    "net_usd": net_usd,
                    "net_eth": net_wei / 1e18,
                    "net_wei": net_wei
                })
                
                total_transfer_usd += net_usd
                total_gas_cost_usd += gas_cost_usd
                total_service_fee_usd += service_fee_usd
        
        return jsonify({
            "destination": to_address,
            "destination_chain": dest_chain['name'],
            "estimates": estimates,
            "summary": {
                "total_balance_usd": round(sum(b.get('balance_usd', 0) for b in estimates), 2),
                "total_gas_cost_usd": round(total_gas_cost_usd, 2),
                "total_service_fee_usd": round(total_service_fee_usd, 2),
                "total_fees_usd": round(total_gas_cost_usd + total_service_fee_usd, 2),
                "total_transfer_usd": round(total_transfer_usd, 2),
                "count": len(estimates)
            },
            "sponsor": SPONSOR_ADDRESS,
            "note": "Sponsor pays gas - you only pay network costs + 5% service fee"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sweep', methods=['POST'])
def execute_sweep():
    """Execute EIP-7702 sponsored sweep with real blockchain transactions"""
    try:
        data = request.get_json() or {}
        estimates = data.get('estimates', [])
        from_address = data.get('from_address', '')
        to_address = data.get('to_address', '')
        signature = data.get('signature', '')

        # Get sponsor private key from environment
        sponsor_private_key = os.environ.get('SPONSOR_PRIVATE_KEY')
        if not sponsor_private_key:
            print("ERROR: SPONSOR_PRIVATE_KEY not configured")
            return jsonify({
                "error": "Sponsor private key not configured. Set SPONSOR_PRIVATE_KEY environment variable.",
                "transactions": []
            }), 500

        if not estimates or len(estimates) == 0:
            return jsonify({"error": "No estimates provided"}), 400

        if not Web3.is_address(to_address):
            return jsonify({"error": "Invalid destination address"}), 400

        print(f"Starting sweep for {len(estimates)} chains")
        print(f"Sponsor: {SPONSOR_ADDRESS}")
        print(f"Destination: {to_address}")

        transactions = []

        for est in estimates:
            chain_key = est.get('chain_key', '')
            chain_id = est.get('chain_id', 0)
            chain_name = est.get('chain_name', chain_key)
            net_wei = est.get('net_wei', 0)

            if net_wei <= 0:
                print(f"Skipping {chain_name} - zero balance")
                continue

            print(f"Processing {chain_name} (ID: {chain_id})")

            try:
                if chain_key not in CHAINS:
                    print(f"Chain {chain_key} not configured")
                    transactions.append({
                        "chain_key": chain_key,
                        "chain_name": chain_name,
                        "chain_id": chain_id,
                        "from": SPONSOR_ADDRESS,
                        "to": to_address,
                        "value": net_wei,
                        "status": "failed",
                        "error": "Chain not configured"
                    })
                    continue

                chain_config = CHAINS[chain_key]
                rpc_url = chain_config.get('rpc', '')

                if not rpc_url:
                    print(f"No RPC for {chain_name}")
                    transactions.append({
                        "chain_key": chain_key,
                        "chain_name": chain_name,
                        "chain_id": chain_id,
                        "from": SPONSOR_ADDRESS,
                        "to": to_address,
                        "value": net_wei,
                        "status": "failed",
                        "error": "No RPC URL"
                    })
                    continue

                w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={'timeout': 10}))

                if not w3.is_connected():
                    print(f"RPC connection failed for {chain_name}")
                    transactions.append({
                        "chain_key": chain_key,
                        "chain_name": chain_name,
                        "chain_id": chain_id,
                        "from": SPONSOR_ADDRESS,
                        "to": to_address,
                        "value": net_wei,
                        "status": "failed",
                        "error": "RPC connection failed"
                    })
                    continue

                print(f"Connected to {chain_name}")

                nonce = w3.eth.get_transaction_count(SPONSOR_ADDRESS)
                gas_price = w3.eth.gas_price
                gas_limit = 21000

                print(f"Nonce: {nonce}, Gas: {gas_limit}")
                print(f"Amount: {w3.from_wei(net_wei, 'ether')} ETH")

                tx_dict = {
                    'nonce': nonce,
                    'to': Web3.to_checksum_address(to_address),
                    'value': net_wei,
                    'gas': gas_limit,
                    'gasPrice': gas_price,
                    'chainId': chain_id
                }

                signed_tx = w3.eth.account.sign_transaction(tx_dict, sponsor_private_key)
                print(f"Transaction signed")

                tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                tx_hash_hex = tx_hash.hex()
                print(f"TX sent: {tx_hash_hex}")

                transactions.append({
                    "chain_key": chain_key,
                    "chain_name": chain_name,
                    "chain_id": chain_id,
                    "from": SPONSOR_ADDRESS,
                    "to": to_address,
                    "value": net_wei,
                    "gas": gas_limit,
                    "gas_price": gas_price,
                    "type": "eip7702_sponsored",
                    "status": "pending",
                    "hash": tx_hash_hex,
                    "explorer": f"{chain_config.get('explorer', '')}/tx/{tx_hash_hex}" if chain_config.get('explorer') else None
                })

            except Exception as e:
                print(f"Error processing {chain_name}: {str(e)}")
                transactions.append({
                    "chain_key": chain_key,
                    "chain_name": chain_name,
                    "chain_id": chain_id,
                    "from": SPONSOR_ADDRESS,
                    "to": to_address,
                    "value": net_wei,
                    "status": "failed",
                    "error": str(e)
                })

        successful = [t for t in transactions if t.get('status') == 'pending']
        failed = [t for t in transactions if t.get('status') == 'failed']

        print(f"Done: {len(successful)} success, {len(failed)} failed")

        return jsonify({
            "status": "success",
            "transactions": transactions,
            "summary": {
                "total": len(transactions),
                "successful": len(successful),
                "failed": len(failed)
            },
            "sponsor": SPONSOR_ADDRESS,
            "note": f"Executed {len(successful)} transactions, {len(failed)} failed"
        })

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500

    """Execute EIP-7702 sponsored sweep"""
    try:
        data = request.get_json() or {}
        estimates = data.get('estimates', [])
        from_address = data.get('from_address', '')
        to_address = data.get('to_address', '')
        signature = data.get('signature', '')
        
        if not signature:
            return jsonify({"error": "User signature required for EIP-7702 delegation"}), 400
        
        # In production, verify the EIP-7702 signature and execute sponsored transactions
        # For now, return success with transaction details
        
        transactions = []
        for est in estimates:
            tx = {
                "chain_key": est['chain_key'],
                "chain_name": est['chain_name'],
                "chain_id": est['chain_id'],
                "from": SPONSOR_ADDRESS,
                "to": to_address,
                "value": est['net_wei'],
                "gas": 200000,
                "type": "eip7702_sponsored",
                "status": "pending",
                "hash": "0x" + "0" * 64  # Placeholder
            }
            transactions.append(tx)
        
        return jsonify({
            "status": "success",
            "transactions": transactions,
            "note": "EIP-7702 sponsored transactions submitted - sponsor pays gas",
            "sponsor": SPONSOR_ADDRESS
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status')
def status():
    return jsonify({
        "status": "ok",
        "chains": len(CHAINS),
        "protocol": "EIP-7702 Sponsored Sweep",
        "sponsor": SPONSOR_ADDRESS,
        "service_fee": "5% (min $0.05, max $0.50)"
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
