#!/usr/bin/env python3
"""
EIP-7702 Dust Aggregator Web Application
Web interface for aggregating dust from multiple EVM chains
Now supports Web3 wallet connection via dapp!
"""

import os
from flask import Flask, render_template, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Fee configuration
FEE_PERCENTAGE = 0.05  # 5%
FEE_ADDRESS = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"

# Chain configurations
CHAINS = {
    'ethereum': {
        'rpc': 'https://eth.llamarpc.com',
        'chain_id': 1,
        'symbol': 'ETH',
        'name': 'Ethereum',
        'color': '#627EEA'
    },
    'polygon': {
        'rpc': 'https://polygon.llamarpc.com',
        'chain_id': 137,
        'symbol': 'MATIC',
        'name': 'Polygon',
        'color': '#8247E5'
    },
    'bsc': {
        'rpc': 'https://bsc-dataseed.binance.org',
        'chain_id': 56,
        'symbol': 'BNB',
        'name': 'BNB Chain',
        'color': '#F3BA2F'
    },
    'arbitrum': {
        'rpc': 'https://arb1.arbitrum.io/rpc',
        'chain_id': 42161,
        'symbol': 'ETH',
        'name': 'Arbitrum',
        'color': '#28A0F0'
    },
    'optimism': {
        'rpc': 'https://mainnet.optimism.io',
        'chain_id': 10,
        'symbol': 'ETH',
        'name': 'Optimism',
        'color': '#FF0420'
    },
    'avalanche': {
        'rpc': 'https://api.avax.network/ext/bc/C/rpc',
        'chain_id': 43114,
        'symbol': 'AVAX',
        'name': 'Avalanche',
        'color': '#E84142'
    },
    'fantom': {
        'rpc': 'https://rpc.ftm.tools',
        'chain_id': 250,
        'symbol': 'FTM',
        'name': 'Fantom',
        'color': '#1969FF'
    },
    'moonbeam': {
        'rpc': 'https://rpc.api.moonbeam.network',
        'chain_id': 1284,
        'symbol': 'GLMR',
        'name': 'Moonbeam',
        'color': '#1B3B6F'
    },
    'celo': {
        'rpc': 'https://forno.celo.org',
        'chain_id': 42220,
        'symbol': 'CELO',
        'name': 'Celo',
        'color': '#FBCC5C'
    },
    'aurora': {
        'rpc': 'https://mainnet.aurora.dev',
        'chain_id': 1313161554,
        'symbol': 'AURORA',
        'name': 'Aurora',
        'color': '#00A8E8'
    },
    'polygon_zkevm': {
        'rpc': 'https://zkevm-rpc.com',
        'chain_id': 1101,
        'symbol': 'ETH',
        'name': 'Polygon zkEVM',
        'color': '#8247E5'
    },
    'linea': {
        'rpc': 'https://rpc.linea.build',
        'chain_id': 59144,
        'symbol': 'ETH',
        'name': 'Linea',
        'color': '#4A90E2'
    },
    'base': {
        'rpc': 'https://mainnet.base.org',
        'chain_id': 8453,
        'symbol': 'ETH',
        'name': 'Base',
        'color': '#0052FF'
    },
    'scroll': {
        'rpc': 'https://rpc.scroll.io',
        'chain_id': 534352,
        'symbol': 'ETH',
        'name': 'Scroll',
        'color': '#FFE600'
    },
    'zksync': {
        'rpc': 'https://mainnet.era.zksync.io',
        'chain_id': 324,
        'symbol': 'ETH',
        'name': 'zkSync Era',
        'color': '#1E1E1E'
    }
}


@app.route('/')
def index():
    """Render main page"""
    return render_template('index.html')


@app.route('/api/chains')
def get_chains():
    """Get available chains"""
    return jsonify({
        'chains': CHAINS,
        'fee_percentage': FEE_PERCENTAGE * 100,
        'fee_address': FEE_ADDRESS
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
