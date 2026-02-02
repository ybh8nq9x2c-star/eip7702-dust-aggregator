from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from web3 import Web3
import os

app = Flask(__name__)
CORS(app)

FEE_PERCENTAGE = 0.05
FEE_ADDRESS = '0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1'

CHAINS = {
    'ethereum': {
        'name': 'Ethereum',
        'rpc': 'https://eth.llamarpc.com',
        'chainId': '0x1',
        'symbol': 'ETH',
        'color': '#627EEA'
    },
    'polygon': {
        'name': 'Polygon',
        'rpc': 'https://polygon.llamarpc.com',
        'chainId': '0x89',
        'symbol': 'MATIC',
        'color': '#8247E5'
    },
    'bsc': {
        'name': 'BNB Chain',
        'rpc': 'https://bsc-dataseed.binance.org',
        'chainId': '0x38',
        'symbol': 'BNB',
        'color': '#F3BA2F'
    },
    'arbitrum': {
        'name': 'Arbitrum',
        'rpc': 'https://arb1.arbitrum.io/rpc',
        'chainId': '0xa4b1',
        'symbol': 'ETH',
        'color': '#28A0F0'
    },
    'optimism': {
        'name': 'Optimism',
        'rpc': 'https://mainnet.optimism.io',
        'chainId': '0xa',
        'symbol': 'ETH',
        'color': '#FF0420'
    },
    'avalanche': {
        'name': 'Avalanche',
        'rpc': 'https://api.avax.network/ext/bc/C/rpc',
        'chainId': '0xa86a',
        'symbol': 'AVAX',
        'color': '#E84142'
    },
    'fantom': {
        'name': 'Fantom',
        'rpc': 'https://rpc.ftm.tools',
        'chainId': '0xfa',
        'symbol': 'FTM',
        'color': '#1969FF'
    },
    'moonbeam': {
        'name': 'Moonbeam',
        'rpc': 'https://rpc.api.moonbeam.network',
        'chainId': '0x504',
        'symbol': 'GLMR',
        'color': '#53CBC8'
    },
    'celo': {
        'name': 'Celo',
        'rpc': 'https://forno.celo.org',
        'chainId': '0xa4ec',
        'symbol': 'CELO',
        'color': '#FCFF52'
    },
    'aurora': {
        'name': 'Aurora',
        'rpc': 'https://mainnet.aurora.dev',
        'chainId': '0x4e454152',
        'symbol': 'ETH',
        'color': '#70D44B'
    },
    'polygon_zkevm': {
        'name': 'Polygon zkEVM',
        'rpc': 'https://zkevm-rpc.com',
        'chainId': '0x44d',
        'symbol': 'ETH',
        'color': '#8247E5'
    },
    'linea': {
        'name': 'Linea',
        'rpc': 'https://rpc.linea.build',
        'chainId': '0xe708',
        'symbol': 'ETH',
        'color': '#61DFFF'
    },
    'base': {
        'name': 'Base',
        'rpc': 'https://mainnet.base.org',
        'chainId': '0x2105',
        'symbol': 'ETH',
        'color': '#0052FF'
    },
    'scroll': {
        'name': 'Scroll',
        'rpc': 'https://rpc.scroll.io',
        'chainId': '0x82750',
        'symbol': 'ETH',
        'color': '#FFEEDA'
    },
    'zksync': {
        'name': 'zkSync Era',
        'rpc': 'https://mainnet.era.zksync.io',
        'chainId': '0x144',
        'symbol': 'ETH',
        'color': '#8C8DFC'
    }
}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/chains', methods=['GET'])
def get_chains():
    return jsonify(CHAINS)

@app.route('/api/balances', methods=['POST'])
def get_balances():
    try:
        data = request.get_json()
        address = data.get('address', '')
        selected_chains = data.get('chains', list(CHAINS.keys()))
        
        if not address or not Web3.is_address(address):
            return jsonify({'error': 'Invalid address'}), 400
        
        checksum_address = Web3.to_checksum_address(address)
        balances = []
        total_balance = 0
        
        for chain_key in selected_chains:
            if chain_key not in CHAINS:
                continue
            chain = CHAINS[chain_key]
            try:
                w3 = Web3(Web3.HTTPProvider(chain['rpc'], request_kwargs={'timeout': 10}))
                if w3.is_connected():
                    balance_wei = w3.eth.get_balance(checksum_address)
                    balance_eth = float(w3.from_wei(balance_wei, 'ether'))
                    total_balance += balance_eth
                    balances.append({
                        'chain': chain['name'],
                        'chain_key': chain_key,
                        'symbol': chain['symbol'],
                        'balance': balance_eth,
                        'color': chain['color'],
                        'chainId': chain['chainId']
                    })
            except Exception as e:
                print(f"Error on {chain['name']}: {str(e)}")
                balances.append({
                    'chain': chain['name'],
                    'chain_key': chain_key,
                    'symbol': chain['symbol'],
                    'balance': 0,
                    'color': chain['color'],
                    'chainId': chain['chainId'],
                    'error': str(e)
                })
        
        fee = total_balance * FEE_PERCENTAGE
        after_fee = total_balance - fee
        
        return jsonify({
            'balances': balances,
            'total_balance': total_balance,
            'fee': fee,
            'after_fee': after_fee,
            'chains_scanned': len(selected_chains)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/aggregate', methods=['POST'])
def aggregate_dust():
    try:
        data = request.get_json()
        address = data.get('address', '')
        destination = data.get('destination', '')
        balances = data.get('balances', [])
        
        if not address or not Web3.is_address(address):
            return jsonify({'error': 'Invalid source address'}), 400
        if not destination or not Web3.is_address(destination):
            return jsonify({'error': 'Invalid destination address'}), 400
        
        checksum_dest = Web3.to_checksum_address(destination)
        checksum_fee = Web3.to_checksum_address(FEE_ADDRESS)
        
        transactions = []
        for b in balances:
            bal = float(b.get('balance', 0))
            if bal > 0.0001:
                fee_amount = bal * FEE_PERCENTAGE
                user_amount = bal - fee_amount - 0.0001
                if user_amount > 0:
                    transactions.append({
                        'chain': b['chain'],
                        'chainId': b['chainId'],
                        'to': checksum_dest,
                        'value': str(user_amount),
                        'fee_to': checksum_fee,
                        'fee_value': str(fee_amount)
                    })
        
        return jsonify({
            'transactions': transactions,
            'total_transactions': len(transactions)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
