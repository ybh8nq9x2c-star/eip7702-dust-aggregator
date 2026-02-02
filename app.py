#!/usr/bin/env python3
"""
EIP-7702 Dust Aggregator Web Application
Web interface for aggregating dust from multiple EVM chains
"""

import os
import json
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
from web3 import Web3

# Load environment variables
load_dotenv()

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
    }
}

class DustAggregator:
    def __init__(self, private_key, target_chain='ethereum'):
        self.private_key = private_key
        self.target_chain = target_chain
        self.connections = {}
        self.address = Web3.to_checksum_address(
            Web3.from_key(private_key).address
        )
        
    def connect_to_chains(self):
        """Connect to all configured chains"""
        results = {}
        for chain_name, config in CHAINS.items():
            try:
                w3 = Web3(Web3.HTTPProvider(config['rpc']))
                if w3.is_connected():
                    self.connections[chain_name] = {
                        'w3': w3,
                        'config': config
                    }
                    results[chain_name] = {'status': 'connected'}
                else:
                    results[chain_name] = {'status': 'failed'}
            except Exception as e:
                results[chain_name] = {'status': 'error', 'error': str(e)}
        return results
    
    def get_balances(self, min_balance=0.0001):
        """Get balances from all chains"""
        balances = {}
        
        for chain_name, conn in self.connections.items():
            w3 = conn['w3']
            config = conn['config']
            
            try:
                balance_wei = w3.eth.get_balance(self.address)
                balance = float(w3.from_wei(balance_wei, 'ether'))
                
                if balance >= min_balance:
                    balances[chain_name] = {
                        'balance': balance,
                        'balance_wei': int(balance_wei),
                        'symbol': config['symbol'],
                        'chain_id': config['chain_id'],
                        'name': config['name'],
                        'color': config['color']
                    }
            except Exception as e:
                pass
        
        return balances
    
    def estimate_gas_cost(self, chain_name):
        """Estimate gas cost for transfer"""
        conn = self.connections[chain_name]
        w3 = conn['w3']
        
        try:
            gas_price = w3.eth.gas_price
            gas_limit = 21000  # Standard transfer
            gas_cost = gas_price * gas_limit
            return gas_cost
        except Exception:
            return 0
    
    def calculate_fee(self, amount_wei):
        """Calculate 5% fee"""
        return int(amount_wei * FEE_PERCENTAGE)
    
    def aggregate_dust(self, target_address):
        """Aggregate dust from all chains to target address with 5% fee"""
        results = []
        total_aggregated = 0
        total_fee = 0
        
        for chain_name, conn in self.connections.items():
            w3 = conn['w3']
            config = conn['config']
            
            try:
                balance_wei = w3.eth.get_balance(self.address)
                balance = float(w3.from_wei(balance_wei, 'ether'))
                
                if balance <= 0:
                    continue
                
                # Estimate gas
                gas_cost = self.estimate_gas_cost(chain_name)
                
                if balance_wei <= gas_cost:
                    continue
                
                # Calculate amount after gas
                amount_after_gas = balance_wei - gas_cost
                
                # Calculate 5% fee
                fee_amount = self.calculate_fee(amount_after_gas)
                amount_to_user = amount_after_gas - fee_amount
                
                if amount_to_user <= 0:
                    continue
                
                # Create transaction to user
                tx_user = {
                    'nonce': w3.eth.get_transaction_count(self.address),
                    'to': Web3.to_checksum_address(target_address),
                    'value': amount_to_user,
                    'gas': 21000,
                    'gasPrice': w3.eth.gas_price,
                    'chainId': config['chain_id']
                }
                
                # Create fee transaction
                tx_fee = {
                    'nonce': w3.eth.get_transaction_count(self.address) + 1,
                    'to': Web3.to_checksum_address(FEE_ADDRESS),
                    'value': fee_amount,
                    'gas': 21000,
                    'gasPrice': w3.eth.gas_price,
                    'chainId': config['chain_id']
                }
                
                # Sign transactions (simulation)
                signed_user = w3.eth.account.sign_transaction(tx_user, self.private_key)
                signed_fee = w3.eth.account.sign_transaction(tx_fee, self.private_key)
                
                results.append({
                    'chain': chain_name,
                    'name': config['name'],
                    'symbol': config['symbol'],
                    'color': config['color'],
                    'original_balance': balance,
                    'gas_cost': float(w3.from_wei(gas_cost, 'ether')),
                    'fee_amount': float(w3.from_wei(fee_amount, 'ether')),
                    'user_amount': float(w3.from_wei(amount_to_user, 'ether')),
                    'total_sent': float(w3.from_wei(amount_after_gas, 'ether')),
                    'status': 'ready',
                    'tx_hash_user': 'SIMULATED',
                    'tx_hash_fee': 'SIMULATED'
                })
                
                total_aggregated += float(w3.from_wei(amount_to_user, 'ether'))
                total_fee += float(w3.from_wei(fee_amount, 'ether'))
                
            except Exception as e:
                results.append({
                    'chain': chain_name,
                    'error': str(e),
                    'status': 'error'
                })
        
        return {
            'results': results,
            'total_aggregated': total_aggregated,
            'total_fee': total_fee,
            'fee_address': FEE_ADDRESS,
            'fee_percentage': FEE_PERCENTAGE * 100
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


@app.route('/api/connect', methods=['POST'])
def connect():
    """Connect to chains"""
    data = request.json
    private_key = data.get('private_key')
    
    if not private_key:
        return jsonify({'error': 'Private key required'}), 400
    
    try:
        aggregator = DustAggregator(private_key)
        results = aggregator.connect_to_chains()
        
        return jsonify({
            'success': True,
            'address': aggregator.address,
            'connections': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/balances', methods=['POST'])
def get_balances():
    """Get balances from all chains"""
    data = request.json
    private_key = data.get('private_key')
    min_balance = data.get('min_balance', 0.0001)
    
    if not private_key:
        return jsonify({'error': 'Private key required'}), 400
    
    try:
        aggregator = DustAggregator(private_key)
        aggregator.connect_to_chains()
        balances = aggregator.get_balances(min_balance=min_balance)
        
        return jsonify({
            'success': True,
            'address': aggregator.address,
            'balances': balances
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/aggregate', methods=['POST'])
def aggregate():
    """Aggregate dust with 5% fee"""
    data = request.json
    private_key = data.get('private_key')
    target_address = data.get('target_address')
    
    if not private_key or not target_address:
        return jsonify({'error': 'Private key and target address required'}), 400
    
    try:
        aggregator = DustAggregator(private_key)
        aggregator.connect_to_chains()
        result = aggregator.aggregate_dust(target_address)
        
        return jsonify({
            'success': True,
            'address': aggregator.address,
            'result': result
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
