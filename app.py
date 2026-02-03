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

# STARGATE ROUTER ADDRESSES (OFT implementation on LayerZero)
# Stargate is the standard for native token bridging with LayerZero
STARGATE_ROUTER = {
    1: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",      # Ethereum
    56: "0x29578d5f5c34ce65da6317c4683a9de0b3d73184",      # BSC
    137: "0x8731d54E9D02c286767d56ac03e8037C07e01e98",    # Polygon
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

# LayerZero Chain IDs (LZ chain IDs, different from native chain IDs)
LZ_CHAIN_IDS = {
    1: 101,          # Ethereum
    56: 102,         # BSC
    137: 109,        # Polygon
    42161: 110,      # Arbitrum
    10: 111,         # Optimism
    43114: 106,      # Avalanche
    250: 107,        # Fantom
    8453: 114,       # Base
    59144: 184,      # Linea
    534352: 170,     # Scroll
    324: 163,        # zkSync
    1284: 126,       # Moonbeam
    42220: 125,      # Celo
    100: 145,        # Gnosis
    1313161554: 148  # Aurora
}

# STARGATE ROUTER ABI (complete)
STARGATE_ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint16", "name": "_dstChainId", "type": "uint16"},
            {"internalType": "uint256", "name": "_srcPoolId", "type": "uint256"},
            {"internalType": "uint256", "name": "_dstPoolId", "type": "uint256"},
            {"internalType": "address payable", "name": "_refundAddress", "type": "address"},
            {"internalType": "address payable", "name": "_amountIn", "type": "address"},
            {"internalType": "uint256", "name": "_minAmountLD", "type": "uint256"},
            {"internalType": "uint256", "name": "_dstGasForCall", "type": "uint256"},
            {"internalType": "uint256", "name": "_lzTxParams", "type": "uint256"},
            {"internalType": "bytes", "name": "_to", "type": "bytes"},
            {"internalType": "bytes", "name": "_payload", "type": "bytes"}
        ],
        "name": "swap",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "uint16", "name": "_dstChainId", "type": "uint16"},
            {"internalType": "uint256", "name": "_srcPoolId", "type": "uint256"},
            {"internalType": "uint256", "name": "_dstPoolId", "type": "uint256"},
            {"internalType": "uint256", "name": "_amountLD", "type": "uint256"},
            {"internalType": "uint256", "name": "_minAmountLD", "type": "uint256"}
        ],
        "name": "quoteLayerZeroFee",
        "outputs": [
            {"internalType": "uint256", "name": "", "type": "uint256"},
            {"internalType": "uint256", "name": "", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# 15 Supported EVM Chains
CHAINS = {
    "ethereum": {
        "name": "Ethereum",
        "rpc": "https://eth.llamarpc.com",
        "chain_id": 1,
        "symbol": "ETH",
        "color": "#627EEA",
        "lifi_id": 1,
        "stargate_pool_id": 13  # ETH pool
    },
    "polygon": {
        "name": "Polygon",
        "rpc": "https://polygon-rpc.com",
        "chain_id": 137,
        "symbol": "MATIC",
        "color": "#8247E5",
        "lifi_id": 137,
        "stargate_pool_id": 113  # WMATIC pool
    },
    "bsc": {
        "name": "BNB Chain",
        "rpc": "https://bsc-dataseed.binance.org",
        "chain_id": 56,
        "symbol": "BNB",
        "color": "#F3BA2F",
        "lifi_id": 56,
        "stargate_pool_id": 2  # BNB pool
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": "https://arb1.arbitrum.io/rpc",
        "chain_id": 42161,
        "symbol": "ETH",
        "color": "#28A0F0",
        "lifi_id": 42161,
        "stargate_pool_id": 13  # ETH pool
    },
    "optimism": {
        "name": "Optimism",
        "rpc": "https://mainnet.optimism.io",
        "chain_id": 10,
        "symbol": "ETH",
        "color": "#FF0420",
        "lifi_id": 10,
        "stargate_pool_id": 13  # ETH pool
    },
    "avalanche": {
        "name": "Avalanche",
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
        "chain_id": 43114,
        "symbol": "AVAX",
        "color": "#E84142",
        "lifi_id": 43114,
        "stargate_pool_id": 3  # WAVAX pool
    },
    "fantom": {
        "name": "Fantom",
        "rpc": "https://rpc.ftm.tools",
        "chain_id": 250,
        "symbol": "FTM",
        "color": "#1969FF",
        "lifi_id": 250,
        "stargate_pool_id": 4  # WFTM pool
    },
    "base": {
        "name": "Base",
        "rpc": "https://mainnet.base.org",
        "chain_id": 8453,
        "symbol": "ETH",
        "color": "#0052FF",
        "lifi_id": 8453,
        "stargate_pool_id": 13  # ETH pool
    },
    "linea": {
        "name": "Linea",
        "rpc": "https://rpc.linea.build",
        "chain_id": 59144,
        "symbol": "ETH",
        "color": "#61DFFF",
        "lifi_id": 59144,
        "stargate_pool_id": 13  # ETH pool
    },
    "scroll": {
        "name": "Scroll",
        "rpc": "https://rpc.scroll.io",
        "chain_id": 534352,
        "symbol": "ETH",
        "color": "#FFDBB0",
        "lifi_id": 534352,
        "stargate_pool_id": 13  # ETH pool
    },
    "zksync": {
        "name": "zkSync Era",
        "rpc": "https://mainnet.era.zksync.io",
        "chain_id": 324,
        "symbol": "ETH",
        "color": "#8C8DFC",
        "lifi_id": 324,
        "stargate_pool_id": 13  # ETH pool
    },
    "moonbeam": {
        "name": "Moonbeam",
        "rpc": "https://rpc.api.moonbeam.network",
        "chain_id": 1284,
        "symbol": "GLMR",
        "color": "#53CBC8",
        "lifi_id": 1284,
        "stargate_pool_id": 5  # WGLMR pool
    },
    "celo": {
        "name": "Celo",
        "rpc": "https://forno.celo.org",
        "chain_id": 42220,
        "symbol": "CELO",
        "color": "#FCFF52",
        "lifi_id": 42220,
        "stargate_pool_id": 6  # WCELO pool
    },
    "gnosis": {
        "name": "Gnosis",
        "rpc": "https://rpc.gnosischain.com",
        "chain_id": 100,
        "symbol": "xDAI",
        "color": "#04795B",
        "lifi_id": 100,
        "stargate_pool_id": 8  # WXDAI pool
    },
    "aurora": {
        "name": "Aurora",
        "rpc": "https://mainnet.aurora.dev",
        "chain_id": 1313161554,
        "symbol": "ETH",
        "color": "#70D44B",
        "lifi_id": 1313161554,
        "stargate_pool_id": 13  # ETH pool
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


def prepare_stargate_bridge(from_chain_id, to_chain_id, from_address, to_address, amount_wei):
    """Prepare Stargate bridge transaction using LayerZero protocol"""
    try:
        # Get source chain config
        from_chain = None
        to_chain = None
        for chain in CHAINS.values():
            if chain['chain_id'] == from_chain_id:
                from_chain = chain
            if chain['chain_id'] == to_chain_id:
                to_chain = chain
        
        if not from_chain or not to_chain:
            return {"error": "Chain config not found"}
        
        # Get Stargate router
        router_addr = STARGATE_ROUTER.get(from_chain_id)
        if not router_addr:
            return {"error": "Stargate router not configured for this chain"}
        
        # Get LayerZero chain IDs
        dst_lz_chain_id = LZ_CHAIN_IDS.get(to_chain_id)
        if not dst_lz_chain_id:
            return {"error": "Destination LayerZero chain ID not configured"}
        
        # Connect to blockchain
        w3 = Web3(Web3.HTTPProvider(
            from_chain['rpc'],
            request_kwargs={'timeout': 10}
        ))
        
        if not w3.is_connected():
            return {"error": "Failed to connect to blockchain"}
        
        # Get router contract
        router = w3.eth.contract(
            address=Web3.to_checksum_address(router_addr),
            abi=STARGATE_ROUTER_ABI
        )
        
        # Stargate Pool IDs
        src_pool_id = from_chain['stargate_pool_id']
        dst_pool_id = to_chain['stargate_pool_id']
        
        # Build Stargate swap() transaction
        # Minimum amount to receive (90% to allow for fees)
        min_amount_ld = int(amount_wei * 0.9)
        
        # Destination gas for receiving tokens (0.01 ETH worth in wei)
        dst_gas_for_call = 0  # No smart contract call
        
        # LayerZero transaction params (300000 gas, airdrop enabled)
        lz_tx_params = 3000000000  # 300k gas with airdrop enabled
        
        # Destination address as bytes
        to_bytes = Web3.to_checksum_address(to_address).rjust(64, '0')
        
        # Payload (empty for native token transfers)
        payload = b''
        
        # Estimate gas
        try:
            gas_estimate = router.functions.swap(
                dst_lz_chain_id,
                src_pool_id,
                dst_pool_id,
                Web3.to_checksum_address(from_address),  # refund address
                Web3.to_checksum_address(from_address),  # amount in
                min_amount_ld,
                dst_gas_for_call,
                lz_tx_params,
                bytes.fromhex(to_bytes),
                payload
            ).estimate_gas({
                'from': from_address,
                'value': amount_wei
            })
        except Exception as e:
            gas_estimate = 350000  # Fallback
        
        # Build transaction data
        tx_data = router.encodeABI(
            fn_name="swap",
            args=[
                dst_lz_chain_id,
                src_pool_id,
                dst_pool_id,
                Web3.to_checksum_address(from_address),  # refund address
                Web3.to_checksum_address(from_address),  # amount in
                min_amount_ld,
                dst_gas_for_call,
                lz_tx_params,
                bytes.fromhex(to_bytes),
                payload
            ]
        )
        
        return {
            "to": router_addr,
            "value": str(amount_wei),
            "data": tx_data.hex(),
            "gas_limit": gas_estimate,
            "dst_lz_chain_id": dst_lz_chain_id,
            "src_pool_id": src_pool_id,
            "dst_pool_id": dst_pool_id,
            "provider": "Stargate (LayerZero)"
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
    """Prepare Stargate bridge transactions using LayerZero"""
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
            
            # Skip low balances (< 0.003 for gas)
            if balance_wei < 3000000000000000:
                continue
            
            chain = CHAINS.get(chain_key)
            if not chain:
                continue
            
            source_chain_id = chain['chain_id']
            
            # Reserve gas (0.003)
            gas_reserve = 3000000000000000
            usable = balance_wei - gas_reserve
            
            if usable <= 0:
                continue
            
            # Calculate fee (5%)
            fee_amount = int(usable * FEE_PERCENTAGE)
            bridge_amount = usable - fee_amount
            
            # Minimum bridge amount (0.01 token to avoid dust)
            if bridge_amount < 10000000000000000:
                continue
            
            # 1. Fee transaction (on source chain)
            transactions.append({
                "type": "fee",
                "chain_key": chain_key,
                "chain_name": chain['name'],
                "chain_id": chain['chain_id'],
                "to": fee_wallet,
                "value": str(fee_amount),
                "value_eth": fee_amount / 1e18
            })
            
            # 2. Stargate bridge transaction using LayerZero
            bridge_tx = prepare_stargate_bridge(
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
                    "gas_limit": bridge_tx['gas_limit'],
                    "provider": "Stargate (LayerZero)",
                    "dst_lz_chain_id": bridge_tx['dst_lz_chain_id'],
                    "src_pool_id": bridge_tx['src_pool_id'],
                    "dst_pool_id": bridge_tx['dst_pool_id']
                })
                
                bridge_quotes.append({
                    "from": chain['name'],
                    "to": dest_chain['name'],
                    "amount_in": bridge_amount / 1e18,
                    "provider": "Stargate (LayerZero)",
                    "lz_chain_id": bridge_tx['dst_lz_chain_id']
                })
        
        return jsonify({
            "destination": to_address,
            "destination_chain": dest_chain['name'],
            "fee_wallet": fee_wallet,
            "transactions": transactions,
            "bridge_quotes": bridge_quotes,
            "count": len(transactions),
            "provider": "Stargate (LayerZero)",
            "protocol": "LayerZero v2 via Stargate"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/status')
def status():
    return jsonify({
        "status": "ok",
        "chains": len(CHAINS),
        "bridge_provider": "Stargate (LayerZero v2)"
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
