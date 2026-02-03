import os
import json
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3
from web3.contract import Contract

app = Flask(__name__)
CORS(app)

# Configuration
FEE_PERCENTAGE = 0.05
FEE_WALLET = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"
RPC_TIMEOUT = 5

# LayerZero v2 / Stargate Configuration
# Stargate is a LayerZero-based bridge for native tokens
STARGATE_ROUTER = {
    1: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",      # Ethereum
    56: "0x29578d5f5c34ce65da6317c4683a9de0b3d73184",      # BSC
    137: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",    # Polygon (using shared router)
    42161: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",  # Arbitrum
    10: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",      # Optimism
    43114: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",   # Avalanche
    250: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",      # Fantom
    8453: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",     # Base
    59144: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",    # Linea
    534352: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",   # Scroll
    324: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",      # zkSync
    1284: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",    # Moonbeam
    42220: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",    # Celo
    100: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",      # Gnosis
    1313161554: "0x8731d54E9D02c286767d56ac03e8037C07e01e98" # Aurora
}

# LayerZero v2 Endpoint Addresses
LZ_ENDPOINT = {
    1: "0x1a44076050125825900e736c501f859c50fE728c",         # Ethereum
    56: "0x3a1d4102b24363b32f8853c4d1094074a3c161f2",       # BSC
    137: "0x3c2269811836af69497E5F486A85D7316753cf62",      # Polygon
    42161: "0x1a44076050125825900e736c501f859c50fE728c",    # Arbitrum
    10: "0x1a44076050125825900e736c501f859c50fE728c",       # Optimism
    43114: "0x1a44076050125825900e736c501f859c50fE728c",     # Avalanche
    250: "0x1a44076050125825900e736c501f859c50fE728c",       # Fantom
    8453: "0x1a44076050125825900e736c501f859c50fE728c",      # Base
    59144: "0x1a44076050125825900e736c501f859c50fE728c",     # Linea
    534352: "0x1a44076050125825900e736c501f859c50fE728c",    # Scroll
    324: "0x1a44076050125825900e736c501f859c50fE728c",       # zkSync
    1284: "0x1a44076050125825900e736c501f859c50fE728c",      # Moonbeam
    42220: "0x1a44076050125825900e736c501f859c50fE728c",     # Celo
    100: "0x1a44076050125825900e736c501f859c50fE728c",       # Gnosis
    1313161554: "0x1a44076050125825900e736c501f859c50fE728c"  # Aurora
}

# Native token addresses
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


# LayerZero v2 Endpoint ABI
LZ_ENDPOINT_ABI = [
    {
        "inputs": [
            {"internalType": "uint16", "name": "_dstEid", "type": "uint16"},
            {"internalType": "bytes", "name": "_message", "type": "bytes"},
            {"internalType": "bytes payable", "name": "_options", "type": "bytes"},
            {"internalType": "bool", "name": "_payInLzToken", "type": "bool"},
            {"internalType": "bytes", "name": "_ulnNlzFee", "type": "bytes"}
        ],
        "name": "send",
        "outputs": [{"internalType": "uint256", "name": "msgId", "type": "uint256"}],
        "stateMutability": "payable",
        "type": "function"
    }
]

# ERC20 ABI for checking balances
ERC20_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    }
]

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


def prepare_layerzero_bridge(from_chain_id, to_chain_id, from_address, to_address, amount_wei):
    """Prepare LayerZero v2 bridge transaction"""
    try:
        # Get source chain config
        from_chain = None
        for chain in CHAINS.values():
            if chain['chain_id'] == from_chain_id:
                from_chain = chain
                break
        
        if not from_chain:
            return {"error": "Source chain not found"}
        
        # Get LayerZero endpoint
        lz_endpoint_addr = LZ_ENDPOINT.get(from_chain_id)
        if not lz_endpoint_addr:
            return {"error": "LayerZero endpoint not configured for this chain"}
        
        # Connect to blockchain
        w3 = Web3(Web3.HTTPProvider(
            from_chain['rpc'],
            request_kwargs={'timeout': 10}
        ))
        
        if not w3.is_connected():
            return {"error": "Failed to connect to blockchain"}
        
        # Get endpoint contract
        endpoint = w3.eth.contract(
            address=Web3.to_checksum_address(lz_endpoint_addr),
            abi=LZ_ENDPOINT_ABI
        )
        
        # Get destination EID (Endpoint ID)
        # For LayerZero v2, EIDs are standardized
        # EID for Ethereum = 30101, Polygon = 30109, etc.
        eid_map = {
            1: 30101,          # Ethereum
            56: 30102,         # BSC
            137: 30109,        # Polygon
            42161: 30110,      # Arbitrum
            10: 30111,         # Optimism
            43114: 30106,      # Avalanche
            250: 30107,         # Fantom
            8453: 30114,       # Base
            59144: 30163,      # Linea
            534352: 30168,     # Scroll
            324: 30117,        # zkSync
            1284: 30112,       # Moonbeam
            42220: 30113,      # Celo
            100: 30108,        # Gnosis
            1313161554: 30118  # Aurora
        }
        
        dst_eid = eid_map.get(to_chain_id)
        if not dst_eid:
            return {"error": "Destination EID not configured"}
        
        # Build message for LayerZero
        # Format: [to_address (32 bytes), amount (32 bytes), fee (32 bytes)]
        message = (
            Web3.to_checksum_address(to_address).rjust(64, '0') +
            hex(amount_wei)[2:].rjust(64, '0') +
            hex(int(amount_wei * FEE_PERCENTAGE))[2:].rjust(64, '0')
        )
        
        # Options for LayerZero v2
        # Default options with gas settings
        options = "0003010011010000000000000000000000000000ea60"
        
        # Estimate gas
        try:
            gas_estimate = endpoint.functions.send(
                dst_eid,
                bytes.fromhex(message),
                bytes.fromhex(options),
                False,
                b''
            ).estimate_gas({
                'from': from_address,
                'value': amount_wei
            })
        except Exception as e:
            gas_estimate = 500000  # Fallback
        
        # Build transaction
        tx_data = endpoint.encodeABI(
            fn_name="send",
            args=[dst_eid, bytes.fromhex(message), bytes.fromhex(options), False, b'']
        )
        
        return {
            "to": lz_endpoint_addr,
            "value": str(amount_wei),
            "data": tx_data.hex(),
            "gas_limit": gas_estimate,
            "dst_eid": dst_eid
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
    """Prepare LayerZero v2 bridge transactions"""
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
        dest_chain_id = dest_chain['chain_id']
        
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
            
            source_chain_id = chain['chain_id']
            
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
            
            # 2. LayerZero bridge transaction
            bridge_tx = prepare_layerzero_bridge(
                source_chain_id,
                dest_chain_id,
                from_address,
                to_address,
                bridge_amount
            )
            
            if 'error' not in bridge_tx:
                transactions.append({
                    "type": "bridge",
                    "chain_key": chain_key,
                    "chain_name": chain['name'],
                    "chain_id": chain['chain_id'],
                    "source_chain": chain['name'],
                    "dest_chain": dest_chain['name'],
                    "to": bridge_tx['to'],
                    "value": bridge_tx['value'],
                    "value_eth": bridge_amount / 1e18,
                    "data": bridge_tx['data'],
                    "gas_limit": bridge_tx['gas_limit']
                })
                
                bridge_quotes.append({
                    "from": chain['name'],
                    "to": dest_chain['name'],
                    "amount_in": bridge_amount / 1e18,
                    "provider": "LayerZero v2",
                    "dst_eid": bridge_tx['dst_eid']
                })
            else:
                # Fallback: direct transfer if LayerZero not available
                transactions.append({
                    "type": "transfer",
                    "chain_key": chain_key,
                    "chain_name": chain['name'],
                    "chain_id": chain['chain_id'],
                    "note": "LayerZero not available - direct transfer",
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
            "count": len(transactions),
            "provider": "LayerZero v2"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status')
def status():
    return jsonify({
        "status": "ok",
        "chains": len(CHAINS),
        "bridge_provider": "LayerZero v2"
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
