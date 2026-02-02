import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3

app = Flask(__name__)
CORS(app)

# Configuration
FEE_PERCENTAGE = 0.05
FEE_WALLET = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"
RPC_TIMEOUT = 5  # 5 seconds max per RPC call

# 15 Supported EVM Chains
CHAINS = {
    "ethereum": {
        "name": "Ethereum",
        "rpc": "https://eth.llamarpc.com",
        "chain_id": 1,
        "symbol": "ETH",
        "color": "#627EEA"
    },
    "polygon": {
        "name": "Polygon",
        "rpc": "https://polygon-rpc.com",
        "chain_id": 137,
        "symbol": "MATIC",
        "color": "#8247E5"
    },
    "bsc": {
        "name": "BNB Chain",
        "rpc": "https://bsc-dataseed.binance.org",
        "chain_id": 56,
        "symbol": "BNB",
        "color": "#F3BA2F"
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": "https://arb1.arbitrum.io/rpc",
        "chain_id": 42161,
        "symbol": "ETH",
        "color": "#28A0F0"
    },
    "optimism": {
        "name": "Optimism",
        "rpc": "https://mainnet.optimism.io",
        "chain_id": 10,
        "symbol": "ETH",
        "color": "#FF0420"
    },
    "avalanche": {
        "name": "Avalanche",
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
        "chain_id": 43114,
        "symbol": "AVAX",
        "color": "#E84142"
    },
    "fantom": {
        "name": "Fantom",
        "rpc": "https://rpc.ftm.tools",
        "chain_id": 250,
        "symbol": "FTM",
        "color": "#1969FF"
    },
    "base": {
        "name": "Base",
        "rpc": "https://mainnet.base.org",
        "chain_id": 8453,
        "symbol": "ETH",
        "color": "#0052FF"
    },
    "linea": {
        "name": "Linea",
        "rpc": "https://rpc.linea.build",
        "chain_id": 59144,
        "symbol": "ETH",
        "color": "#61DFFF"
    },
    "scroll": {
        "name": "Scroll",
        "rpc": "https://rpc.scroll.io",
        "chain_id": 534352,
        "symbol": "ETH",
        "color": "#FFDBB0"
    },
    "zksync": {
        "name": "zkSync Era",
        "rpc": "https://mainnet.era.zksync.io",
        "chain_id": 324,
        "symbol": "ETH",
        "color": "#8C8DFC"
    },
    "moonbeam": {
        "name": "Moonbeam",
        "rpc": "https://rpc.api.moonbeam.network",
        "chain_id": 1284,
        "symbol": "GLMR",
        "color": "#53CBC8"
    },
    "celo": {
        "name": "Celo",
        "rpc": "https://forno.celo.org",
        "chain_id": 42220,
        "symbol": "CELO",
        "color": "#FCFF52"
    },
    "gnosis": {
        "name": "Gnosis",
        "rpc": "https://rpc.gnosischain.com",
        "chain_id": 100,
        "symbol": "xDAI",
        "color": "#04795B"
    },
    "aurora": {
        "name": "Aurora",
        "rpc": "https://mainnet.aurora.dev",
        "chain_id": 1313161554,
        "symbol": "ETH",
        "color": "#70D44B"
    }
}


def get_balance_for_chain(key, chain, address):
    """Get balance for a single chain - runs in thread"""
    result = {
        "key": key,
        "name": chain['name'],
        "chain_id": chain['chain_id'],
        "symbol": chain['symbol'],
        "color": chain['color'],
        "balance": 0.0,
        "balance_wei": "0"
    }
    
    try:
        w3 = Web3(Web3.HTTPProvider(
            chain['rpc'],
            request_kwargs={'timeout': RPC_TIMEOUT}
        ))
        
        if w3.is_connected():
            bal_wei = w3.eth.get_balance(address)
            result['balance'] = float(w3.from_wei(bal_wei, 'ether'))
            result['balance_wei'] = str(bal_wei)
    except Exception as e:
        result['error'] = str(e)[:30]
    
    return result


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/chains')
def get_chains():
    """Return all supported chains"""
    return jsonify(CHAINS)


@app.route('/api/balances', methods=['POST'])
def get_balances():
    """Scan balances across selected chains using parallel requests"""
    try:
        data = request.get_json() or {}
        address = data.get('address', '')
        selected = data.get('chains', list(CHAINS.keys()))
        
        # Validate address
        if not address or len(address) != 42:
            return jsonify({"error": "Invalid address"}), 400
        
        try:
            address = Web3.to_checksum_address(address)
        except:
            return jsonify({"error": "Invalid address format"}), 400
        
        results = []
        total = 0.0
        
        # Use ThreadPoolExecutor for parallel RPC calls
        with ThreadPoolExecutor(max_workers=15) as executor:
            futures = {}
            
            for key in selected:
                if key in CHAINS:
                    chain = CHAINS[key]
                    future = executor.submit(get_balance_for_chain, key, chain, address)
                    futures[future] = key
            
            # Collect results as they complete
            for future in as_completed(futures, timeout=30):
                try:
                    result = future.result()
                    results.append(result)
                    total += result.get('balance', 0)
                except Exception as e:
                    key = futures[future]
                    results.append({
                        "key": key,
                        "name": CHAINS[key]['name'],
                        "chain_id": CHAINS[key]['chain_id'],
                        "symbol": CHAINS[key]['symbol'],
                        "color": CHAINS[key]['color'],
                        "balance": 0.0,
                        "balance_wei": "0",
                        "error": "timeout"
                    })
        
        # Sort by balance descending
        results.sort(key=lambda x: x.get('balance', 0), reverse=True)
        
        fee = total * FEE_PERCENTAGE
        
        return jsonify({
            "address": address,
            "balances": results,
            "total": round(total, 8),
            "fee": round(fee, 8),
            "net": round(total - fee, 8)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/prepare', methods=['POST'])
def prepare_transactions():
    """Prepare transactions for aggregation"""
    try:
        data = request.get_json() or {}
        balances = data.get('balances', [])
        destination = data.get('destination', '')
        
        # Validate destination
        if not destination or len(destination) != 42:
            return jsonify({"error": "Invalid destination"}), 400
        
        try:
            destination = Web3.to_checksum_address(destination)
            fee_wallet = Web3.to_checksum_address(FEE_WALLET)
        except:
            return jsonify({"error": "Invalid address format"}), 400
        
        transactions = []
        
        for bal in balances:
            balance_wei = int(bal.get('balance_wei', '0') or '0')
            
            # Skip if balance too low (< 0.001)
            if balance_wei < 1000000000000000:
                continue
            
            chain_id = bal.get('chain_id')
            chain_key = bal.get('key', '')
            chain_name = bal.get('name', '')
            
            # Reserve gas (0.002 native token)
            gas_reserve = 2000000000000000
            usable = balance_wei - gas_reserve
            
            if usable <= 0:
                continue
            
            # Calculate amounts
            fee_amount = int(usable * FEE_PERCENTAGE)
            transfer_amount = usable - fee_amount
            
            # Fee transaction
            transactions.append({
                "chain_key": chain_key,
                "chain_name": chain_name,
                "chain_id": chain_id,
                "type": "fee",
                "to": fee_wallet,
                "value": str(fee_amount),
                "value_eth": fee_amount / 1e18
            })
            
            # Transfer transaction
            transactions.append({
                "chain_key": chain_key,
                "chain_name": chain_name,
                "chain_id": chain_id,
                "type": "transfer",
                "to": destination,
                "value": str(transfer_amount),
                "value_eth": transfer_amount / 1e18
            })
        
        return jsonify({
            "destination": destination,
            "fee_wallet": fee_wallet,
            "transactions": transactions,
            "count": len(transactions)
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status')
def status():
    return jsonify({"status": "ok", "chains": len(CHAINS)})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
