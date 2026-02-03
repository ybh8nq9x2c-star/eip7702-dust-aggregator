"""
Dust.zip - Simple EIP-7702 Dust Aggregator
Scan balances across 15 chains and aggregate with 5% fee
"""

import os
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3
from eth_account import Account

app = Flask(__name__)
CORS(app)

# Configuration
FEE_WALLET = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"
FEE_PERCENT = 0.05  # 5%
RPC_TIMEOUT = 10

# 15 EVM Chains
CHAINS = {
    "ethereum": {"name": "Ethereum", "rpc": "https://eth.llamarpc.com", "chain_id": 1, "symbol": "ETH", "color": "#627EEA", "explorer": "https://etherscan.io/tx/"},
    "polygon": {"name": "Polygon", "rpc": "https://polygon-rpc.com", "chain_id": 137, "symbol": "MATIC", "color": "#8247E5", "explorer": "https://polygonscan.com/tx/"},
    "bsc": {"name": "BNB Chain", "rpc": "https://bsc-dataseed.binance.org", "chain_id": 56, "symbol": "BNB", "color": "#F3BA2F", "explorer": "https://bscscan.com/tx/"},
    "arbitrum": {"name": "Arbitrum", "rpc": "https://arb1.arbitrum.io/rpc", "chain_id": 42161, "symbol": "ETH", "color": "#28A0F0", "explorer": "https://arbiscan.io/tx/"},
    "optimism": {"name": "Optimism", "rpc": "https://mainnet.optimism.io", "chain_id": 10, "symbol": "ETH", "color": "#FF0420", "explorer": "https://optimistic.etherscan.io/tx/"},
    "avalanche": {"name": "Avalanche", "rpc": "https://api.avax.network/ext/bc/C/rpc", "chain_id": 43114, "symbol": "AVAX", "color": "#E84142", "explorer": "https://snowtrace.io/tx/"},
    "fantom": {"name": "Fantom", "rpc": "https://rpc.ftm.tools", "chain_id": 250, "symbol": "FTM", "color": "#1969FF", "explorer": "https://ftmscan.com/tx/"},
    "moonbeam": {"name": "Moonbeam", "rpc": "https://rpc.api.moonbeam.network", "chain_id": 1284, "symbol": "GLMR", "color": "#00D0FF", "explorer": "https://moonscan.io/tx/"},
    "celo": {"name": "Celo", "rpc": "https://forno.celo.org", "chain_id": 42220, "symbol": "CELO", "color": "#FBCC5C", "explorer": "https://celoscan.io/tx/"},
    "aurora": {"name": "Aurora", "rpc": "https://mainnet.aurora.dev", "chain_id": 1313161554, "symbol": "ETH", "color": "#00A9FF", "explorer": "https://explorer.mainnet.aurora.dev/tx/"},
    "polygon_zkevm": {"name": "Polygon zkEVM", "rpc": "https://zkevm-rpc.com", "chain_id": 1101, "symbol": "ETH", "color": "#8247E5", "explorer": "https://zkevm.polygonscan.com/tx/"},
    "linea": {"name": "Linea", "rpc": "https://rpc.linea.build", "chain_id": 59144, "symbol": "ETH", "color": "#5A9BC4", "explorer": "https://lineascan.build/tx/"},
    "base": {"name": "Base", "rpc": "https://mainnet.base.org", "chain_id": 8453, "symbol": "ETH", "color": "#0052FF", "explorer": "https://basescan.org/tx/"},
    "scroll": {"name": "Scroll", "rpc": "https://rpc.scroll.io", "chain_id": 534352, "symbol": "ETH", "color": "#FFD700", "explorer": "https://scrollscan.com/tx/"},
    "zksync": {"name": "zkSync Era", "rpc": "https://mainnet.era.zksync.io", "chain_id": 324, "symbol": "ETH", "color": "#2E2E2E", "explorer": "https://explorer.zksync.io/tx/"}
}

def get_web3(chain_key):
    """Get Web3 instance for chain"""
    try:
        w3 = Web3(Web3.HTTPProvider(CHAINS[chain_key]["rpc"], request_kwargs={"timeout": RPC_TIMEOUT}))
        if w3.is_connected():
            return w3
    except:
        pass
    return None

def get_balance(w3, address):
    """Get balance in ether"""
    try:
        balance_wei = w3.eth.get_balance(Web3.to_checksum_address(address))
        return float(w3.from_wei(balance_wei, "ether"))
    except:
        return 0.0

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/chains")
def get_chains():
    """Get all supported chains"""
    return jsonify(CHAINS)

@app.route("/api/balances", methods=["POST"])
def scan_balances():
    """Scan balances across all chains"""
    data = request.json
    address = data.get("address")
    selected_chains = data.get("chains", list(CHAINS.keys()))
    
    if not address:
        return jsonify({"error": "Address required"}), 400
    
    balances = []
    
    def scan_chain(chain_key):
        try:
            w3 = get_web3(chain_key)
            if w3:
                balance = get_balance(w3, address)
                if balance > 0.000001:  # Only show meaningful balances
                    chain = CHAINS[chain_key]
                    balances.append({
                        "chain": chain_key,
                        "name": chain["name"],
                        "symbol": chain["symbol"],
                        "balance": balance,
                        "color": chain["color"],
                        "chain_id": chain["chain_id"]
                    })
        except Exception as e:
            pass
        return None
    
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(scan_chain, key): key for key in selected_chains if key in CHAINS}
        for future in as_completed(futures):
            future.result()
    
    return jsonify({"balances": balances})

@app.route("/api/estimate", methods=["POST"])
def estimate():
    """Estimate gas and fees"""
    data = request.json
    from_address = data.get("address")
    selected_chains = data.get("chains", [])
    
    if not from_address or not selected_chains:
        return jsonify({"error": "Address and chains required"}), 400
    
    estimates = []
    
    for chain_key in selected_chains:
        if chain_key not in CHAINS:
            continue
        
        try:
            w3 = get_web3(chain_key)
            if not w3:
                continue
            
            balance = get_balance(w3, from_address)
            if balance < 0.0001:
                continue
            
            chain = CHAINS[chain_key]
            
            # Calculate fee (5%)
            fee_amount = balance * FEE_PERCENT
            user_amount = balance - fee_amount
            
            # Estimate gas
            gas_price = w3.eth.gas_price
            gas_limit = 21000  # Standard transfer
            gas_cost = w3.from_wei(gas_price * gas_limit, "ether")
            
            estimates.append({
                "chain": chain_key,
                "name": chain["name"],
                "balance": balance,
                "fee": fee_amount,
                "user_amount": user_amount,
                "gas_cost": float(gas_cost)
            })
        except Exception as e:
            continue
    
    return jsonify({"estimates": estimates})

@app.route("/api/execute", methods=["POST"])
def execute():
    """Prepare transactions for execution (frontend signs)"""
    data = request.json
    from_address = data.get("address")
    to_address = data.get("to_address")
    selected_chains = data.get("chains", [])
    
    if not from_address or not to_address or not selected_chains:
        return jsonify({"error": "Address and chains required"}), 400
    
    transactions = []
    
    for chain_key in selected_chains:
        if chain_key not in CHAINS:
            continue
        
        try:
            w3 = get_web3(chain_key)
            if not w3:
                continue
            
            balance = get_balance(w3, from_address)
            if balance < 0.0001:
                continue
            
            chain = CHAINS[chain_key]
            
            # Calculate amounts
            fee_amount = balance * FEE_PERCENT
            user_amount = balance - fee_amount
            
            # Prepare fee transaction
            fee_tx = {
                "to": FEE_WALLET,
                "value": hex(int(w3.to_wei(fee_amount, "ether"))),
                "gasPrice": hex(w3.eth.gas_price),
                "gas": hex(21000),
                "chainId": hex(chain["chain_id"])
            }
            
            # Prepare user transaction
            user_tx = {
                "to": to_address,
                "value": hex(int(w3.to_wei(user_amount, "ether"))),
                "gasPrice": hex(w3.eth.gas_price),
                "gas": hex(21000),
                "chainId": hex(chain["chain_id"])
            }
            
            transactions.append({
                "chain": chain_key,
                "name": chain["name"],
                "fee_tx": fee_tx,
                "user_tx": user_tx,
                "fee_amount": fee_amount,
                "user_amount": user_amount,
                "explorer": chain["explorer"]
            })
        except Exception as e:
            continue
    
    return jsonify({"transactions": transactions})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
