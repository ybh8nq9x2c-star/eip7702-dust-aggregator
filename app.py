#!/usr/bin/env python3
"""
EIP-7702 Dust Aggregator Web Application
Web interface for aggregating dust from multiple EVM chains
Now supports Web3 wallet connection via dapp!
"""

import os
import json
from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from web3 import Web3

app = Flask(__name__)
CORS(app)

# Fee configuration
FEE_PERCENTAGE = 0.05 # 5%
FEE_ADDRESS = "0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1"

# Load contract addresses
CONTRACT_ADDRESSES = {}
try:
    with open('contract_addresses.json', 'r') as f:
        CONTRACT_ADDRESSES = json.load(f)
except:
    pass

# Chain configurations
CHAINS = {
 'ethereum': {
 'rpc': 'https://eth.llamarpc.com',
 'chain_id': 1,
 'symbol': 'ETH',
 'name': 'Ethereum',
 'color': '#627EEA',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'polygon': {
 'rpc': 'https://polygon.llamarpc.com',
 'chain_id': 137,
 'symbol': 'MATIC',
 'name': 'Polygon',
 'color': '#8247E5',
 'native_currency': {
 'name': 'MATIC',
 'symbol': 'MATIC',
 'decimals': 18
 }
 },
 'bsc': {
 'rpc': 'https://bsc-dataseed.binance.org',
 'chain_id': 56,
 'symbol': 'BNB',
 'name': 'BNB Chain',
 'color': '#F3BA2F',
 'native_currency': {
 'name': 'BNB',
 'symbol': 'BNB',
 'decimals': 18
 }
 },
 'arbitrum': {
 'rpc': 'https://arb1.arbitrum.io/rpc',
 'chain_id': 42161,
 'symbol': 'ETH',
 'name': 'Arbitrum',
 'color': '#28A0F0',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'optimism': {
 'rpc': 'https://mainnet.optimism.io',
 'chain_id': 10,
 'symbol': 'ETH',
 'name': 'Optimism',
 'color': '#FF0420',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'avalanche': {
 'rpc': 'https://api.avax.network/ext/bc/C/rpc',
 'chain_id': 43114,
 'symbol': 'AVAX',
 'name': 'Avalanche',
 'color': '#E84142',
 'native_currency': {
 'name': 'Avalanche',
 'symbol': 'AVAX',
 'decimals': 18
 }
 },
 'fantom': {
 'rpc': 'https://rpc.ftm.tools',
 'chain_id': 250,
 'symbol': 'FTM',
 'name': 'Fantom',
 'color': '#1969FF',
 'native_currency': {
 'name': 'Fantom',
 'symbol': 'FTM',
 'decimals': 18
 }
 },
 'moonbeam': {
 'rpc': 'https://rpc.api.moonbeam.network',
 'chain_id': 1284,
 'symbol': 'GLMR',
 'name': 'Moonbeam',
 'color': '#1B3B6F',
 'native_currency': {
 'name': 'Glimmer',
 'symbol': 'GLMR',
 'decimals': 18
 }
 },
 'celo': {
 'rpc': 'https://forno.celo.org',
 'chain_id': 42220,
 'symbol': 'CELO',
 'name': 'Celo',
 'color': '#FBCC5C',
 'native_currency': {
 'name': 'Celo',
 'symbol': 'CELO',
 'decimals': 18
 }
 },
 'aurora': {
 'rpc': 'https://mainnet.aurora.dev',
 'chain_id': 1313161554,
 'symbol': 'AURORA',
 'name': 'Aurora',
 'color': '#00A8E8',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'polygon_zkevm': {
 'rpc': 'https://zkevm-rpc.com',
 'chain_id': 1101,
 'symbol': 'ETH',
 'name': 'Polygon zkEVM',
 'color': '#8247E5',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'linea': {
 'rpc': 'https://rpc.linea.build',
 'chain_id': 59144,
 'symbol': 'ETH',
 'name': 'Linea',
 'color': '#4A90E2',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'base': {
 'rpc': 'https://mainnet.base.org',
 'chain_id': 8453,
 'symbol': 'ETH',
 'name': 'Base',
 'color': '#0052FF',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'scroll': {
 'rpc': 'https://rpc.scroll.io',
 'chain_id': 534352,
 'symbol': 'ETH',
 'name': 'Scroll',
 'color': '#FFE600',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 },
 'zksync': {
 'rpc': 'https://mainnet.era.zksync.io',
 'chain_id': 324,
 'symbol': 'ETH',
 'name': 'zkSync Era',
 'color': '#1E1E1E',
 'native_currency': {
 'name': 'Ether',
 'symbol': 'ETH',
 'decimals': 18
 }
 }
}

# Smart contract ABI (simplified for the aggregateDust function)
CONTRACT_ABI = [
 {
 "inputs": [
 {"internalType": "address payable", "name": "to", "type": "address"}
 ],
 "name": "aggregateDust",
 "outputs": [],
 "stateMutability": "payable",
 "type": "function"
 }
]


@app.route('/')
def index():
 """Render main page"""
 return render_template('index.html')


@app.route('/api/chains')
def get_chains():
 """Get available chains"""
 chains_with_contracts = {}
 for chain_key, chain_config in CHAINS.items():
 chains_with_contracts[chain_key] = {
 **chain_config,
 'contract_address': CONTRACT_ADDRESSES.get(chain_key, '0x0000000000000000000000000000000000000000')
 }
 
 return jsonify({
 'chains': chains_with_contracts,
 'fee_percentage': FEE_PERCENTAGE * 100,
 'fee_address': FEE_ADDRESS
 })


@app.route('/api/balances', methods=['POST'])
def get_balances():
 """Get balances for a given address across all chains"""
 try:
 data = request.get_json()
 address = data.get('address')
 
 if not address:
 return jsonify({'error': 'Address is required'}), 400
 
 # Validate address
 if not Web3.is_address(address):
 return jsonify({'error': 'Invalid address'}), 400
 
 balances = []
 
 for chain_key, chain_config in CHAINS.items():
 try:
 # Connect to chain
 w3 = Web3(Web3.HTTPProvider(chain_config['rpc']))
 
 if not w3.is_connected():
 print(f"Failed to connect to {chain_config['name']}")
 continue
 
 # Get balance
 balance_wei = w3.eth.get_balance(address)
 balance_eth = w3.from_wei(balance_wei, 'ether')
 
 # Only include if balance > 0
 if float(balance_eth) > 0:
 balances.append({
 'chain': chain_config['name'],
 'chain_key': chain_key,
 'symbol': chain_config['symbol'],
 'balance': float(balance_eth),
 'address': address,
 'color': chain_config['color'],
 'contract_address': CONTRACT_ADDRESSES.get(chain_key, '0x0000000000000000000000000000000000000000')
 })
 
 except Exception as e:
 print(f"Error checking {chain_config['name']}: {str(e)}")
 continue
 
 return jsonify({
 'balances': balances,
 'total_chains': len(CHAINS),
 'chains_with_balance': len(balances)
 })
 
 except Exception as e:
 return jsonify({'error': str(e)}), 500


@app.route('/api/aggregate', methods=['POST'])
def aggregate_dust():
 """Prepare transactions for aggregating dust from multiple chains"""
 try:
 data = request.get_json()
 address = data.get('address')
 target_address = data.get('target_address')
 
 if not address:
 return jsonify({'error': 'Address is required'}), 400
 
 if not target_address:
 return jsonify({'error': 'Target address is required'}), 400
 
 # Validate addresses
 if not Web3.is_address(address) or not Web3.is_address(target_address):
 return jsonify({'error': 'Invalid address'}), 400
 
 transactions = []
 total_amount = 0
 
 for chain_key, chain_config in CHAINS.items():
 try:
 # Connect to chain
 w3 = Web3(Web3.HTTPProvider(chain_config['rpc']))
 
 if not w3.is_connected():
 continue
 
 # Get balance
 balance_wei = w3.eth.get_balance(address)
 balance_eth = w3.from_wei(balance_wei, 'ether')
 
 # Only process if balance > 0
 if float(balance_eth) > 0:
 # Calculate fee
 fee = float(balance_eth) * FEE_PERCENTAGE
 amount_after_fee = float(balance_eth) - fee
 
 total_amount += amount_after_fee
 
 # Get contract address
 contract_address = CONTRACT_ADDRESSES.get(chain_key, '0x0000000000000000000000000000000000000000')
 
 # Prepare transaction data for smart contract call
 contract = w3.eth.contract(address=contract_address, abi=CONTRACT_ABI)
 
 # Build transaction
 tx_data = contract.functions.aggregateDust(target_address).build_transaction({
 'from': address,
 'value': balance_wei,
 'gas': 100000, # Estimate gas
 'gasPrice': w3.eth.gas_price,
 'nonce': w3.eth.get_transaction_count(address)
 })
 
 transactions.append({
 'chain': chain_config['name'],
 'chain_key': chain_key,
 'chain_id': chain_config['chain_id'],
 'symbol': chain_config['symbol'],
 'amount': amount_after_fee,
 'fee': fee,
 'to': target_address,
 'from': address,
 'contract_address': contract_address,
 'tx_data': tx_data,
 'native_currency': chain_config['native_currency'],
 'status': 'pending',
 'color': chain_config['color']
 })
 
 except Exception as e:
 print(f"Error processing {chain_config['name']}: {str(e)}")
 continue
 
 return jsonify({
 'transactions': transactions,
 'total_amount': total_amount,
 'total_fee': total_amount * FEE_PERCENTAGE,
 'status': 'prepared'
 })
 
 except Exception as e:
 return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
 port = int(os.environ.get('PORT', 5000))
 app.run(host='0.0.0.0', port=port, debug=False)
