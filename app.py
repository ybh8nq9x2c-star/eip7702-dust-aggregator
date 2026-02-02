import os
import requests
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3

app = Flask(__name__)
CORS(app)

# Configuration
FEE_PERCENTAGE = 0.05
FEE_WALLET = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"

# 15 Supported EVM Chains
CHAINS = {
    "ethereum": {
        "name": "Ethereum",
        "rpc": "https://eth.llamarpc.com",
        "chain_id": 1,
        "symbol": "ETH",
        "color": "#627EEA",
        "explorer": "https://etherscan.io"
    },
    "polygon": {
        "name": "Polygon",
        "rpc": "https://polygon.llamarpc.com",
        "chain_id": 137,
        "symbol": "MATIC",
        "color": "#8247E5",
        "explorer": "https://polygonscan.com"
    },
    "bsc": {
        "name": "BNB Chain",
        "rpc": "https://bsc.llamarpc.com",
        "chain_id": 56,
        "symbol": "BNB",
        "color": "#F3BA2F",
        "explorer": "https://bscscan.com"
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": "https://arbitrum.llamarpc.com",
        "chain_id": 42161,
        "symbol": "ETH",
        "color": "#28A0F0",
        "explorer": "https://arbiscan.io"
    },
    "optimism": {
        "name": "Optimism",
        "rpc": "https://optimism.llamarpc.com",
        "chain_id": 10,
        "symbol": "ETH",
        "color": "#FF0420",
        "explorer": "https://optimistic.etherscan.io"
    },
    "avalanche": {
        "name": "Avalanche",
        "rpc": "https://avalanche.llamarpc.com",
        "chain_id": 43114,
        "symbol": "AVAX",
        "color": "#E84142",
        "explorer": "https://snowtrace.io"
    },
    "fantom": {
        "name": "Fantom",
        "rpc": "https://rpc.ftm.tools",
        "chain_id": 250,
        "symbol": "FTM",
        "color": "#1969FF",
        "explorer": "https://ftmscan.com"
    },
    "base": {
        "name": "Base",
        "rpc": "https://base.llamarpc.com",
        "chain_id": 8453,
        "symbol": "ETH",
        "color": "#0052FF",
        "explorer": "https://basescan.org"
    },
    "linea": {
        "name": "Linea",
        "rpc": "https://rpc.linea.build",
        "chain_id": 59144,
        "symbol": "ETH",
        "color": "#61DFFF",
        "explorer": "https://lineascan.build"
    },
    "scroll": {
        "name": "Scroll",
        "rpc": "https://rpc.scroll.io",
        "chain_id": 534352,
        "symbol": "ETH",
        "color": "#FFDBB0",
        "explorer": "https://scrollscan.com"
    },
    "zksync": {
        "name": "zkSync Era",
        "rpc": "https://mainnet.era.zksync.io",
        "chain_id": 324,
        "symbol": "ETH",
        "color": "#8C8DFC",
        "explorer": "https://explorer.zksync.io"
    },
    "moonbeam": {
        "name": "Moonbeam",
        "rpc": "https://rpc.api.moonbeam.network",
        "chain_id": 1284,
        "symbol": "GLMR",
        "color": "#53CBC8",
        "explorer": "https://moonscan.io"
    },
    "celo": {
        "name": "Celo",
        "rpc": "https://forno.celo.org",
        "chain_id": 42220,
        "symbol": "CELO",
        "color": "#FCFF52",
        "explorer": "https://celoscan.io"
    },
    "gnosis": {
        "name": "Gnosis",
        "rpc": "https://rpc.gnosischain.com",
        "chain_id": 100,
        "symbol": "xDAI",
        "color": "#04795B",
        "explorer": "https://gnosisscan.io"
    },
    "aurora": {
        "name": "Aurora",
        "rpc": "https://mainnet.aurora.dev",
        "chain_id": 1313161554,
        "symbol": "ETH",
        "color": "#70D44B",
        "explorer": "https://explorer.aurora.dev"
    }
}


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/chains')
def get_chains():
    """Return all supported chains"""
    return jsonify(CHAINS)


@app.route('/api/balances', methods=['POST'])
def get_balances():
    """Scan balances across selected chains"""
    try:
        data = request.get_json()
        address = data.get('address', '')
        selected = data.get('chains', list(CHAINS.keys()))
        
        if not address or len(address) != 42:
            return jsonify({"error": "Invalid address"}), 400
        
        address = Web3.to_checksum_address(address)
        results = []
        total = 0
        
        for key in selected:
            if key not in CHAINS:
                continue
            chain = CHAINS[key]
            try:
                w3 = Web3(Web3.HTTPProvider(chain['rpc'], request_kwargs={'timeout': 10}))
                if w3.is_connected():
                    bal_wei = w3.eth.get_balance(address)
                    bal_eth = float(w3.from_wei(bal_wei, 'ether'))
                    results.append({
                        "key": key,
                        "name": chain['name'],
                        "chain_id": chain['chain_id'],
                        "symbol": chain['symbol'],
                        "color": chain['color'],
                        "balance": bal_eth,
                        "balance_wei": str(bal_wei)
                    })
                    total += bal_eth
                else:
                    results.append({
                        "key": key,
                        "name": chain['name'],
                        "chain_id": chain['chain_id'],
                        "symbol": chain['symbol'],
                        "color": chain['color'],
                        "balance": 0,
                        "balance_wei": "0",
                        "error": "RPC unavailable"
                    })
            except Exception as e:
                results.append({
                    "key": key,
                    "name": chain['name'],
                    "chain_id": chain['chain_id'],
                    "symbol": chain['symbol'],
                    "color": chain['color'],
                    "balance": 0,
                    "balance_wei": "0",
                    "error": str(e)[:50]
                })
        
        fee = total * FEE_PERCENTAGE
        return jsonify({
            "address": address,
            "balances": results,
            "total": total,
            "fee": fee,
            "net": total - fee
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/prepare', methods=['POST'])
def prepare_transactions():
    """
    Prepare transactions for aggregation.
    For each chain with balance, returns 2 transactions:
    1. Fee transaction (5% to fee wallet)
    2. Transfer transaction (95% to destination)
    """
    try:
        data = request.get_json()
        balances = data.get('balances', [])
        destination = data.get('destination', '')
        
        if not destination or len(destination) != 42:
            return jsonify({"error": "Invalid destination"}), 400
        
        destination = Web3.to_checksum_address(destination)
        fee_wallet = Web3.to_checksum_address(FEE_WALLET)
        
        transactions = []
        
        for bal in balances:
            balance_wei = int(bal.get('balance_wei', '0'))
            if balance_wei < 1000000000000000:  # Skip < 0.001
                continue
            
            chain_id = bal.get('chain_id')
            chain_key = bal.get('key')
            chain_name = bal.get('name', '')
            
            # Estimate gas cost (0.005 native token reserved)
            gas_reserve = 5000000000000000  # 0.005
            usable = balance_wei - gas_reserve
            
            if usable <= 0:
                continue
            
            # Calculate fee (5%)
            fee_amount = int(usable * FEE_PERCENTAGE)
            transfer_amount = usable - fee_amount
            
            chain_id_hex = hex(chain_id)
            
            # Transaction 1: Fee to platform
            transactions.append({
                "chain_key": chain_key,
                "chain_name": chain_name,
                "chain_id": chain_id,
                "chain_id_hex": chain_id_hex,
                "type": "fee",
                "to": fee_wallet,
                "value": str(fee_amount),
                "value_eth": float(fee_amount) / 1e18,
                "description": f"Platform fee (5%) on {chain_name}"
            })
            
            # Transaction 2: Transfer to destination
            transactions.append({
                "chain_key": chain_key,
                "chain_name": chain_name,
                "chain_id": chain_id,
                "chain_id_hex": chain_id_hex,
                "type": "transfer",
                "to": destination,
                "value": str(transfer_amount),
                "value_eth": float(transfer_amount) / 1e18,
                "description": f"Transfer to destination on {chain_name}"
            })
        
        return jsonify({
            "destination": destination,
            "fee_wallet": fee_wallet,
            "fee_percentage": FEE_PERCENTAGE,
            "transaction_count": len(transactions),
            "transactions": transactions
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status')
def status():
    return jsonify({
        "status": "ok",
        "chains": len(CHAINS),
        "fee": f"{FEE_PERCENTAGE*100}%",
        "fee_wallet": FEE_WALLET
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
