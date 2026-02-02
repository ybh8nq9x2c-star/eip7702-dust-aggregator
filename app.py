#!/usr/bin/env python3
"""
EIP-7702 Dust Aggregator Web Application
Web interface for aggregating dust from multiple EVM chains
"""

import os
import json
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3

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
        'symbol': 'ETH',
        'name': 'Aurora',
        'color': '#70D44B'
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
        'color': '#121212'
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
        'color': '#FFEEDA'
    },
    'zksync': {
        'rpc': 'https://mainnet.era.zksync.io',
        'chain_id': 324,
        'symbol': 'ETH',
        'name': 'zkSync Era',
        'color': '#8C8DFC'
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


@app.route('/api/balances', methods=['POST'])
def get_balances():
    """Get balances for a given address across all chains"""
    try:
        data = request.get_json()
        address = data.get('address', '').strip()

        if not address:
            return jsonify({'error': 'Address is required'}), 400

        # Validate address
        if not Web3.is_address(address):
            return jsonify({'error': 'Invalid address'}), 400

        # Convert to checksum address
        checksum_address = Web3.to_checksum_address(address)

        balances = []
        chains_with_balance = 0
        total_balance = 0.0

        for chain_key, chain_config in CHAINS.items():
            try:
                # Connect to chain with timeout
                w3 = Web3(Web3.HTTPProvider(chain_config['rpc'], request_kwargs={'timeout': 10}))

                if not w3.is_connected():
                    print(f"Failed to connect to {chain_config['name']}")
                    continue

                # Get balance
                balance_wei = w3.eth.get_balance(checksum_address)
                balance_ether = float(w3.from_wei(balance_wei, 'ether'))

                if balance_ether > 0:
                    chains_with_balance += 1
                    total_balance += balance_ether
                    balances.append({
                        'chain': chain_config['name'],
                        'chain_key': chain_key,
                        'chain_id': chain_config['chain_id'],
                        'symbol': chain_config['symbol'],
                        'color': chain_config['color'],
                        'balance': balance_ether,  # Float for frontend
                        'balance_wei': str(balance_wei)  # String for precision
                    })
            except Exception as e:
                print(f"Error checking {chain_config['name']}: {str(e)}")
                continue

        # Calculate fee and amount after fee
        total_fee = total_balance * FEE_PERCENTAGE
        total_after_fee = total_balance - total_fee

        return jsonify({
            'balances': balances,
            'chains_with_balance': chains_with_balance,
            'total_balance': total_balance,
            'total_fee': total_fee,
            'total_after_fee': total_after_fee
        })

    except Exception as e:
        print(f"Error in get_balances: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/aggregate', methods=['POST'])
def aggregate_dust():
    """Prepare transactions for aggregating dust from multiple chains"""
    try:
        data = request.get_json()
        address = data.get('address', '').strip()
        target_address = data.get('target_address', '').strip()

        if not address:
            return jsonify({'error': 'Source address is required'}), 400

        if not target_address:
            return jsonify({'error': 'Target address is required'}), 400

        # Validate addresses
        if not Web3.is_address(address):
            return jsonify({'error': 'Invalid source address'}), 400

        if not Web3.is_address(target_address):
            return jsonify({'error': 'Invalid target address'}), 400

        # Convert to checksum addresses
        checksum_address = Web3.to_checksum_address(address)
        checksum_target = Web3.to_checksum_address(target_address)
        checksum_fee_address = Web3.to_checksum_address(FEE_ADDRESS)

        transactions = []
        total_amount = 0.0
        total_fee = 0.0

        for chain_key, chain_config in CHAINS.items():
            try:
                # Connect to chain with timeout
                w3 = Web3(Web3.HTTPProvider(chain_config['rpc'], request_kwargs={'timeout': 10}))

                if not w3.is_connected():
                    print(f"Failed to connect to {chain_config['name']}")
                    continue

                # Get balance
                balance_wei = w3.eth.get_balance(checksum_address)
                balance_ether = float(w3.from_wei(balance_wei, 'ether'))

                # Only process if balance > 0
                if balance_ether > 0:
                    # Estimate gas cost
                    gas_price = w3.eth.gas_price
                    gas_limit = 21000  # Standard transfer
                    gas_cost_wei = gas_price * gas_limit * 2  # Two transfers (to target + fee)
                    gas_cost_ether = float(w3.from_wei(gas_cost_wei, 'ether'))

                    # Skip if gas cost is higher than balance
                    if gas_cost_ether >= balance_ether:
                        print(f"Skipping {chain_config['name']}: gas cost ({gas_cost_ether}) >= balance ({balance_ether})")
                        continue

                    # Calculate amounts
                    available_balance = balance_ether - gas_cost_ether
                    fee_amount = available_balance * FEE_PERCENTAGE
                    user_amount = available_balance - fee_amount

                    total_amount += user_amount
                    total_fee += fee_amount

                    # Get nonce
                    nonce = w3.eth.get_transaction_count(checksum_address)

                    transactions.append({
                        'chain': chain_config['name'],
                        'chain_key': chain_key,
                        'chain_id': chain_config['chain_id'],
                        'symbol': chain_config['symbol'],
                        'color': chain_config['color'],
                        'balance': balance_ether,
                        'amount': user_amount,
                        'fee': fee_amount,
                        'gas_cost': gas_cost_ether,
                        'from_address': checksum_address,
                        'to_address': checksum_target,
                        'fee_address': checksum_fee_address,
                        'nonce': nonce,
                        'gas_price': gas_price,
                        'gas_limit': gas_limit,
                        'status': 'pending'
                    })
            except Exception as e:
                print(f"Error processing {chain_config['name']}: {str(e)}")
                continue

        return jsonify({
            'transactions': transactions,
            'total_amount': total_amount,
            'total_fee': total_fee,
            'fee_address': FEE_ADDRESS,
            'status': 'prepared'
        })

    except Exception as e:
        print(f"Error in aggregate_dust: {str(e)}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
