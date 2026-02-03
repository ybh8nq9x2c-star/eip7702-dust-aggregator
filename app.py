import os
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3

app = Flask(__name__)
CORS(app)

# Configuration
FEE_PERCENTAGE = 0.05
FEE_WALLET = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"
RPC_TIMEOUT = 5
LIFI_API = "https://li.quest/v1"

# Native token addresses (used by LI.FI)
NATIVE_TOKEN = "0x0000000000000000000000000000000000000000"

# 15 Supported EVM Chains
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
        "rpc": "https://polygon-rpc.com",
        "chain_id": 137,
        "symbol": "MATIC",
        "color": "#8247E5",
        "lifi_id": 137
    },
    "bsc": {
        "name": "BNB Chain",
        "rpc": "https://bsc-dataseed.binance.org",
        "chain_id": 56,
        "symbol": "BNB",
        "color": "#F3BA2F",
        "lifi_id": 56
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": "https://arb1.arbitrum.io/rpc",
        "chain_id": 42161,
        "symbol": "ETH",
        "color": "#28A0F0",
        "lifi_id": 42161
    },
    "optimism": {
        "name": "Optimism",
        "rpc": "https://mainnet.optimism.io",
        "chain_id": 10,
        "symbol": "ETH",
        "color": "#FF0420",
        "lifi_id": 10
    },
    "avalanche": {
        "name": "Avalanche",
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
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
        "rpc": "https://mainnet.base.org",
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
        "color": "#FFDBB0",
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


def get_balance_for_chain(key, chain, address):
    """Get balance for a single chain"""
    result = {
        "key": key,
        "name": chain['name'],
        "chain_id": chain['chain_id'],
        "lifi_id": chain['lifi_id'],
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


def get_bridge_quote(from_chain_id, to_chain_id, from_address, to_address, amount_wei):
    """Get bridge quote from LI.FI"""
    try:
        params = {
            "fromChain": from_chain_id,
            "toChain": to_chain_id,
            "fromToken": NATIVE_TOKEN,
            "toToken": NATIVE_TOKEN,
            "fromAddress": from_address,
            "toAddress": to_address,
            "fromAmount": str(amount_wei),
            "slippage": "0.03"
        }
        
        resp = requests.get(
            f"{LIFI_API}/quote",
            params=params,
            timeout=10
        )
        
        if resp.status_code == 200:
            return resp.json()
        else:
            return {"error": f"LI.FI API error: {resp.status_code}"}
            
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
        total = 0.0
        
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
                    total += result.get('balance', 0)
                except:
                    pass
        
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


@app.route('/api/prepare-bridge', methods=['POST'])
def prepare_bridge():
    """Prepare bridge transactions using LI.FI"""
    try:
        data = request.get_json() or {}
        balances = data.get('balances', [])
        from_address = data.get('from_address', '')
        to_address = data.get('to_address', '')
        dest_chain_key = data.get('destination_chain', 'ethereum')
        
        # Validate
        if not from_address or len(from_address) != 42:
            return jsonify({"error": "Invalid from address"}), 400
        if not to_address or len(to_address) != 42:
            return jsonify({"error": "Invalid to address"}), 400
        if dest_chain_key not in CHAINS:
            return jsonify({"error": "Invalid destination chain"}), 400
        
        try:
            from_address = Web3.to_checksum_address(from_address)
            to_address = Web3.to_checksum_address(to_address)
            fee_wallet = Web3.to_checksum_address(FEE_WALLET)
        except:
            return jsonify({"error": "Invalid address format"}), 400
        
        dest_chain = CHAINS[dest_chain_key]
        dest_chain_id = dest_chain['lifi_id']
        
        transactions = []
        bridge_quotes = []
        
        for bal in balances:
            balance_wei = int(bal.get('balance_wei', '0') or '0')
            chain_key = bal.get('key', '')
            
            # Skip destination chain (no bridge needed)
            if chain_key == dest_chain_key:
                continue
            
            # Skip low balances (< 0.002 for gas)
            if balance_wei < 2000000000000000:
                continue
            
            chain = CHAINS.get(chain_key)
            if not chain:
                continue
            
            source_chain_id = chain['lifi_id']
            
            # Reserve gas (0.002)
            gas_reserve = 2000000000000000
            usable = balance_wei - gas_reserve
            
            if usable <= 0:
                continue
            
            # Calculate fee (5%)
            fee_amount = int(usable * FEE_PERCENTAGE)
            bridge_amount = usable - fee_amount
            
            # 1. Fee transaction (on source chain)
            transactions.append({
                "type": "fee",
                "chain_key": chain_key,
                "chain_name": chain['name'],
                "chain_id": chain['chain_id'],
                "to": fee_wallet,
                "value": str(fee_amount),
                "value_eth": fee_amount / 1e18,
                "data": "0x"
            })
            
            # 2. Get bridge quote from LI.FI
            quote = get_bridge_quote(
                source_chain_id,
                dest_chain_id,
                from_address,
                to_address,
                bridge_amount
            )
            
            if 'error' not in quote and 'transactionRequest' in quote:
                tx_req = quote['transactionRequest']
                
                transactions.append({
                    "type": "bridge",
                    "chain_key": chain_key,
                    "chain_name": chain['name'],
                    "chain_id": chain['chain_id'],
                    "source_chain": chain['name'],
                    "dest_chain": dest_chain['name'],
                    "to": tx_req.get('to', ''),
                    "value": tx_req.get('value', '0'),
                    "value_eth": bridge_amount / 1e18,
                    "data": tx_req.get('data', '0x'),
                    "gas_limit": tx_req.get('gasLimit', '300000')
                })
                
                bridge_quotes.append({
                    "from": chain['name'],
                    "to": dest_chain['name'],
                    "amount_in": bridge_amount / 1e18,
                    "amount_out": int(quote.get('estimate', {}).get('toAmount', 0)) / 1e18,
                    "tool": quote.get('toolDetails', {}).get('name', 'Unknown')
                })
            else:
                # Fallback: direct transfer if bridge not available
                transactions.append({
                    "type": "transfer",
                    "chain_key": chain_key,
                    "chain_name": chain['name'],
                    "chain_id": chain['chain_id'],
                    "note": "Bridge not available - direct transfer",
                    "to": to_address,
                    "value": str(bridge_amount),
                    "value_eth": bridge_amount / 1e18,
                    "data": "0x"
                })
        
        return jsonify({
            "destination": to_address,
            "destination_chain": dest_chain['name'],
            "fee_wallet": fee_wallet,
            "transactions": transactions,
            "bridge_quotes": bridge_quotes,
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
