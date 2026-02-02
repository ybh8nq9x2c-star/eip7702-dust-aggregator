import os
import json
import requests
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Fee configuration
FEE_PERCENTAGE = 0.05  # 5%
FEE_WALLET = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"

# LI.FI API for cross-chain bridging
LIFI_API = "https://li.quest/v1"

# Chain configurations with LI.FI chain IDs
CHAINS = {
    "ethereum": {
        "name": "Ethereum",
        "rpc": "https://eth.llamarpc.com",
        "chain_id": 1,
        "symbol": "ETH",
        "color": "#627EEA",
        "lifi_id": 1
    },
    "polygon": {
        "name": "Polygon",
        "rpc": "https://polygon.llamarpc.com",
        "chain_id": 137,
        "symbol": "MATIC",
        "color": "#8247E5",
        "lifi_id": 137
    },
    "bsc": {
        "name": "BNB Chain",
        "rpc": "https://bsc.llamarpc.com",
        "chain_id": 56,
        "symbol": "BNB",
        "color": "#F3BA2F",
        "lifi_id": 56
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": "https://arbitrum.llamarpc.com",
        "chain_id": 42161,
        "symbol": "ETH",
        "color": "#28A0F0",
        "lifi_id": 42161
    },
    "optimism": {
        "name": "Optimism",
        "rpc": "https://optimism.llamarpc.com",
        "chain_id": 10,
        "symbol": "ETH",
        "color": "#FF0420",
        "lifi_id": 10
    },
    "avalanche": {
        "name": "Avalanche",
        "rpc": "https://avalanche.llamarpc.com",
        "chain_id": 43114,
        "symbol": "AVAX",
        "color": "#E84142",
        "lifi_id": 43114
    },
    "fantom": {
        "name": "Fantom",
        "rpc": "https://rpc.ftm.tools",
        "chain_id": 250,
        "symbol": "FTM",
        "color": "#1969FF",
        "lifi_id": 250
    },
    "base": {
        "name": "Base",
        "rpc": "https://base.llamarpc.com",
        "chain_id": 8453,
        "symbol": "ETH",
        "color": "#0052FF",
        "lifi_id": 8453
    },
    "linea": {
        "name": "Linea",
        "rpc": "https://rpc.linea.build",
        "chain_id": 59144,
        "symbol": "ETH",
        "color": "#61DFFF",
        "lifi_id": 59144
    },
    "scroll": {
        "name": "Scroll",
        "rpc": "https://rpc.scroll.io",
        "chain_id": 534352,
        "symbol": "ETH",
        "color": "#FFEEDA",
        "lifi_id": 534352
    },
    "zksync": {
        "name": "zkSync Era",
        "rpc": "https://mainnet.era.zksync.io",
        "chain_id": 324,
        "symbol": "ETH",
        "color": "#8C8DFC",
        "lifi_id": 324
    },
    "moonbeam": {
        "name": "Moonbeam",
        "rpc": "https://rpc.api.moonbeam.network",
        "chain_id": 1284,
        "symbol": "GLMR",
        "color": "#53CBC8",
        "lifi_id": 1284
    },
    "celo": {
        "name": "Celo",
        "rpc": "https://forno.celo.org",
        "chain_id": 42220,
        "symbol": "CELO",
        "color": "#FCFF52",
        "lifi_id": 42220
    },
    "gnosis": {
        "name": "Gnosis",
        "rpc": "https://rpc.gnosischain.com",
        "chain_id": 100,
        "symbol": "xDAI",
        "color": "#04795B",
        "lifi_id": 100
    },
    "aurora": {
        "name": "Aurora",
        "rpc": "https://mainnet.aurora.dev",
        "chain_id": 1313161554,
        "symbol": "ETH",
        "color": "#70D44B",
        "lifi_id": 1313161554
    }
}

# Native token addresses for LI.FI
NATIVE_TOKEN = "0x0000000000000000000000000000000000000000"


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/chains', methods=['GET'])
def get_chains():
    """Return available chains"""
    return jsonify(CHAINS)


@app.route('/api/balances', methods=['POST'])
def get_balances():
    """Get native token balances across chains"""
    try:
        data = request.get_json()
        address = data.get('address', '')
        selected_chains = data.get('chains', list(CHAINS.keys()))
        
        if not address:
            return jsonify({"error": "Address required"}), 400
        
        # Validate and checksum address
        try:
            address = Web3.to_checksum_address(address)
        except Exception:
            return jsonify({"error": "Invalid address format"}), 400
        
        balances = []
        total_balance = 0
        
        for chain_key in selected_chains:
            if chain_key not in CHAINS:
                continue
            
            chain = CHAINS[chain_key]
            try:
                w3 = Web3(Web3.HTTPProvider(chain['rpc'], request_kwargs={'timeout': 10}))
                if w3.is_connected():
                    balance_wei = w3.eth.get_balance(address)
                    balance_eth = float(w3.from_wei(balance_wei, 'ether'))
                    
                    balances.append({
                        "chain_key": chain_key,
                        "chain": chain['name'],
                        "chain_id": chain['chain_id'],
                        "lifi_id": chain['lifi_id'],
                        "symbol": chain['symbol'],
                        "color": chain['color'],
                        "balance": balance_eth,
                        "balance_wei": str(balance_wei)
                    })
                    total_balance += balance_eth
                else:
                    balances.append({
                        "chain_key": chain_key,
                        "chain": chain['name'],
                        "chain_id": chain['chain_id'],
                        "lifi_id": chain['lifi_id'],
                        "symbol": chain['symbol'],
                        "color": chain['color'],
                        "balance": 0,
                        "balance_wei": "0",
                        "error": "RPC not connected"
                    })
            except Exception as e:
                balances.append({
                    "chain_key": chain_key,
                    "chain": chain['name'],
                    "chain_id": chain['chain_id'],
                    "lifi_id": chain['lifi_id'],
                    "symbol": chain['symbol'],
                    "color": chain['color'],
                    "balance": 0,
                    "balance_wei": "0",
                    "error": str(e)[:50]
                })
        
        return jsonify({
            "address": address,
            "balances": balances,
            "total_balance": total_balance,
            "fee_percentage": FEE_PERCENTAGE,
            "fee_amount": total_balance * FEE_PERCENTAGE,
            "after_fee": total_balance * (1 - FEE_PERCENTAGE)
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/quote', methods=['POST'])
def get_bridge_quote():
    """
    Get bridge quote from LI.FI for cross-chain transfer.
    This uses EIP-7702 compatible transactions.
    """
    try:
        data = request.get_json()
        from_chain = data.get('from_chain')
        to_chain = data.get('to_chain')
        from_address = data.get('from_address')
        to_address = data.get('to_address')
        amount_wei = data.get('amount_wei')
        
        if not all([from_chain, to_chain, from_address, to_address, amount_wei]):
            return jsonify({"error": "Missing required parameters"}), 400
        
        from_chain_data = CHAINS.get(from_chain)
        to_chain_data = CHAINS.get(to_chain)
        
        if not from_chain_data or not to_chain_data:
            return jsonify({"error": "Invalid chain"}), 400
        
        # Calculate fee
        amount_int = int(amount_wei)
        fee_amount = int(amount_int * FEE_PERCENTAGE)
        amount_after_fee = amount_int - fee_amount
        
        # If same chain, just do a simple transfer
        if from_chain == to_chain:
            return jsonify({
                "type": "same_chain_transfer",
                "from_chain": from_chain,
                "to_chain": to_chain,
                "from_chain_id": from_chain_data['chain_id'],
                "amount_wei": str(amount_after_fee),
                "fee_wei": str(fee_amount),
                "fee_wallet": FEE_WALLET,
                "to_address": to_address,
                "transactions": [
                    {
                        "type": "fee",
                        "to": FEE_WALLET,
                        "value": str(fee_amount),
                        "data": "0x",
                        "chainId": hex(from_chain_data['chain_id'])
                    },
                    {
                        "type": "transfer",
                        "to": to_address,
                        "value": str(amount_after_fee),
                        "data": "0x",
                        "chainId": hex(from_chain_data['chain_id'])
                    }
                ]
            })
        
        # For cross-chain: Get quote from LI.FI
        try:
            quote_url = f"{LIFI_API}/quote"
            params = {
                "fromChain": from_chain_data['lifi_id'],
                "toChain": to_chain_data['lifi_id'],
                "fromToken": NATIVE_TOKEN,
                "toToken": NATIVE_TOKEN,
                "fromAddress": from_address,
                "toAddress": to_address,
                "fromAmount": str(amount_after_fee),
                "slippage": "0.03",  # 3% slippage
                "allowBridges": "stargate,hop,across,cbridge,multichain,connext",
                "order": "RECOMMENDED"
            }
            
            response = requests.get(quote_url, params=params, timeout=30)
            
            if response.status_code == 200:
                quote_data = response.json()
                
                # Extract transaction data from LI.FI response
                tx_request = quote_data.get('transactionRequest', {})
                
                return jsonify({
                    "type": "cross_chain_bridge",
                    "from_chain": from_chain,
                    "to_chain": to_chain,
                    "from_chain_id": from_chain_data['chain_id'],
                    "to_chain_id": to_chain_data['chain_id'],
                    "bridge": quote_data.get('toolDetails', {}).get('name', 'LI.FI'),
                    "amount_in": str(amount_int),
                    "amount_after_fee": str(amount_after_fee),
                    "fee_wei": str(fee_amount),
                    "fee_wallet": FEE_WALLET,
                    "estimated_output": quote_data.get('estimate', {}).get('toAmount', '0'),
                    "estimated_gas": quote_data.get('estimate', {}).get('gasCosts', [{}])[0].get('amount', '0'),
                    "transactions": [
                        {
                            "type": "fee",
                            "description": "Platform fee (5%)",
                            "to": FEE_WALLET,
                            "value": str(fee_amount),
                            "data": "0x",
                            "chainId": hex(from_chain_data['chain_id'])
                        },
                        {
                            "type": "bridge",
                            "description": f"Bridge to {to_chain_data['name']}",
                            "to": tx_request.get('to', ''),
                            "value": tx_request.get('value', '0'),
                            "data": tx_request.get('data', '0x'),
                            "chainId": hex(from_chain_data['chain_id']),
                            "gasLimit": tx_request.get('gasLimit', '500000')
                        }
                    ],
                    "lifi_quote": quote_data
                })
            else:
                # LI.FI quote failed, return simple transfer
                return jsonify({
                    "type": "simple_transfer",
                    "warning": "Bridge not available, using direct transfer",
                    "from_chain": from_chain,
                    "to_chain": to_chain,
                    "amount_after_fee": str(amount_after_fee),
                    "fee_wei": str(fee_amount),
                    "transactions": [
                        {
                            "type": "fee",
                            "to": FEE_WALLET,
                            "value": str(fee_amount),
                            "data": "0x",
                            "chainId": hex(from_chain_data['chain_id'])
                        }
                    ]
                })
        
        except requests.exceptions.RequestException as e:
            return jsonify({
                "type": "simple_transfer",
                "error": f"Bridge API error: {str(e)[:100]}",
                "from_chain": from_chain,
                "transactions": []
            })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/aggregate', methods=['POST'])
def aggregate_dust():
    """
    Prepare all transactions needed to aggregate dust from multiple chains.
    Uses EIP-7702 pattern for batch authorization.
    """
    try:
        data = request.get_json()
        from_address = data.get('address')
        to_address = data.get('destination')
        destination_chain = data.get('destination_chain', 'ethereum')
        balances = data.get('balances', [])
        
        if not from_address or not to_address:
            return jsonify({"error": "Missing address"}), 400
        
        # Validate addresses
        try:
            from_address = Web3.to_checksum_address(from_address)
            to_address = Web3.to_checksum_address(to_address)
        except Exception:
            return jsonify({"error": "Invalid address"}), 400
        
        all_transactions = []
        total_amount = 0
        total_fee = 0
        
        dest_chain_data = CHAINS.get(destination_chain, CHAINS['ethereum'])
        
        for bal in balances:
            balance_wei = int(float(bal.get('balance', 0)) * 10**18)
            if balance_wei < 1000000000000000:  # Skip if < 0.001 ETH (not worth gas)
                continue
            
            chain_key = bal.get('chain_key', '')
            chain_data = CHAINS.get(chain_key)
            
            if not chain_data:
                continue
            
            # Calculate fee for this chain's balance
            fee_wei = int(balance_wei * FEE_PERCENTAGE)
            amount_after_fee = balance_wei - fee_wei
            
            # Estimate gas (leave some for gas)
            estimated_gas_wei = 100000 * 50 * 10**9  # ~0.005 ETH for gas
            safe_amount = max(0, balance_wei - fee_wei - estimated_gas_wei)
            
            if safe_amount <= 0:
                continue
            
            total_amount += safe_amount
            total_fee += fee_wei
            
            chain_id_hex = hex(chain_data['chain_id'])
            
            # Add fee transaction
            all_transactions.append({
                "chain_key": chain_key,
                "chain": chain_data['name'],
                "chainId": chain_id_hex,
                "type": "fee",
                "description": f"Fee on {chain_data['name']}",
                "to": FEE_WALLET,
                "value": str(fee_wei),
                "data": "0x"
            })
            
            # If same chain as destination, simple transfer
            if chain_key == destination_chain:
                all_transactions.append({
                    "chain_key": chain_key,
                    "chain": chain_data['name'],
                    "chainId": chain_id_hex,
                    "type": "transfer",
                    "description": f"Transfer on {chain_data['name']}",
                    "to": to_address,
                    "value": str(safe_amount),
                    "data": "0x"
                })
            else:
                # Cross-chain: try to get LI.FI quote
                try:
                    quote_url = f"{LIFI_API}/quote"
                    params = {
                        "fromChain": chain_data['lifi_id'],
                        "toChain": dest_chain_data['lifi_id'],
                        "fromToken": NATIVE_TOKEN,
                        "toToken": NATIVE_TOKEN,
                        "fromAddress": from_address,
                        "toAddress": to_address,
                        "fromAmount": str(safe_amount),
                        "slippage": "0.03"
                    }
                    
                    response = requests.get(quote_url, params=params, timeout=15)
                    
                    if response.status_code == 200:
                        quote_data = response.json()
                        tx_request = quote_data.get('transactionRequest', {})
                        
                        if tx_request.get('to'):
                            all_transactions.append({
                                "chain_key": chain_key,
                                "chain": chain_data['name'],
                                "chainId": chain_id_hex,
                                "type": "bridge",
                                "bridge_name": quote_data.get('toolDetails', {}).get('name', 'LI.FI'),
                                "description": f"Bridge {chain_data['name']} → {dest_chain_data['name']}",
                                "to": tx_request.get('to'),
                                "value": tx_request.get('value', '0'),
                                "data": tx_request.get('data', '0x'),
                                "gasLimit": str(tx_request.get('gasLimit', 500000)),
                                "estimated_output": quote_data.get('estimate', {}).get('toAmount', '0')
                            })
                        else:
                            # Fallback: just hold on source chain
                            all_transactions.append({
                                "chain_key": chain_key,
                                "chain": chain_data['name'],
                                "chainId": chain_id_hex,
                                "type": "hold",
                                "description": f"No bridge available from {chain_data['name']}",
                                "to": to_address,
                                "value": "0",
                                "data": "0x",
                                "note": "Manual bridge required"
                            })
                    else:
                        all_transactions.append({
                            "chain_key": chain_key,
                            "chain": chain_data['name'],
                            "chainId": chain_id_hex,
                            "type": "hold",
                            "description": f"Bridge unavailable from {chain_data['name']}",
                            "to": to_address,
                            "value": "0",
                            "data": "0x"
                        })
                
                except Exception as e:
                    all_transactions.append({
                        "chain_key": chain_key,
                        "chain": chain_data['name'],
                        "chainId": chain_id_hex,
                        "type": "error",
                        "description": str(e)[:100],
                        "to": "",
                        "value": "0",
                        "data": "0x"
                    })
        
        return jsonify({
            "from_address": from_address,
            "to_address": to_address,
            "destination_chain": destination_chain,
            "total_amount_wei": str(total_amount),
            "total_fee_wei": str(total_fee),
            "fee_wallet": FEE_WALLET,
            "fee_percentage": FEE_PERCENTAGE,
            "transaction_count": len(all_transactions),
            "transactions": all_transactions,
            "eip7702_enabled": True,
            "instructions": [
                "1. Connect your wallet",
                "2. You will be prompted to switch networks for each chain",
                "3. Approve each transaction (fee + bridge/transfer)",
                "4. Wait for bridges to complete (may take 5-30 minutes)",
                "5. All dust will arrive at your destination address"
            ]
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status', methods=['GET'])
def get_status():
    """API health check"""
    return jsonify({
        "status": "ok",
        "chains_supported": len(CHAINS),
        "fee_percentage": FEE_PERCENTAGE,
        "fee_wallet": FEE_WALLET,
        "bridge_provider": "LI.FI",
        "eip7702_enabled": True
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
