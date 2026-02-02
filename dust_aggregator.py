#!/usr/bin/env python3
"""
EIP-7702 Dust Aggregator Tool
Aggregates dust amounts from multiple EVM chains into a single chain
"""

import json
import os
from dotenv import load_dotenv
from web3 import Web3
from web3.exceptions import TransactionNotFound

# Load environment variables
load_dotenv()

# Chain configurations
CHAINS = {
    'ethereum': {
        'rpc': 'https://eth.llamarpc.com',
        'chain_id': 1,
        'symbol': 'ETH'
    },
    'polygon': {
        'rpc': 'https://polygon.llamarpc.com',
        'chain_id': 137,
        'symbol': 'MATIC'
    },
    'bsc': {
        'rpc': 'https://bsc-dataseed.binance.org',
        'chain_id': 56,
        'symbol': 'BNB'
    },
    'arbitrum': {
        'rpc': 'https://arb1.arbitrum.io/rpc',
        'chain_id': 42161,
        'symbol': 'ETH'
    },
    'optimism': {
        'rpc': 'https://mainnet.optimism.io',
        'chain_id': 10,
        'symbol': 'ETH'
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
        for chain_name, config in CHAINS.items():
            try:
                w3 = Web3(Web3.HTTPProvider(config['rpc']))
                if w3.is_connected():
                    self.connections[chain_name] = {
                        'w3': w3,
                        'config': config
                    }
                    print(f"✓ Connected to {chain_name}")
                else:
                    print(f"✗ Failed to connect to {chain_name}")
            except Exception as e:
                print(f"✗ Error connecting to {chain_name}: {e}")
    
    def get_balances(self, min_balance=0.001):
        """Get balances from all chains"""
        balances = {}
        
        for chain_name, conn in self.connections.items():
            w3 = conn['w3']
            config = conn['config']
            
            try:
                balance_wei = w3.eth.get_balance(self.address)
                balance = w3.from_wei(balance_wei, 'ether')
                
                if float(balance) >= min_balance:
                    balances[chain_name] = {
                        'balance': float(balance),
                        'balance_wei': balance_wei,
                        'symbol': config['symbol'],
                        'chain_id': config['chain_id']
                    }
                    print(f"  {chain_name}: {balance} {config['symbol']}")
            except Exception as e:
                print(f"  Error getting balance from {chain_name}: {e}")
        
        return balances
    
    def estimate_gas_cost(self, chain_name, amount_wei):
        """Estimate gas cost for transfer"""
        conn = self.connections[chain_name]
        w3 = conn['w3']
        
        try:
            gas_price = w3.eth.gas_price
            gas_limit = 21000  # Standard transfer
            gas_cost = gas_price * gas_limit
            return gas_cost
        except Exception as e:
            print(f"  Error estimating gas for {chain_name}: {e}")
            return 0
    
    def create_eip7702_delegation(self, chain_name, target_address):
        """Create EIP-7702 delegation transaction"""
        conn = self.connections[chain_name]
        w3 = conn['w3']
        
        # EIP-7702 transaction structure
        tx = {
            'from': self.address,
            'to': target_address,  # Delegation target
            'value': 0,
            'gas': 100000,
            'maxFeePerGas': w3.eth.gas_price,
            'maxPriorityFeePerGas': w3.eth.gas_price,
            'chainId': conn['config']['chain_id'],
            'nonce': w3.eth.get_transaction_count(self.address),
            'type': 4,  # EIP-7702 transaction type
            'authorizationList': [{
                'chainId': conn['config']['chain_id'],
                'address': target_address,
                'nonce': w3.eth.get_transaction_count(self.address)
            }]
        }
        
        return tx
    
    def aggregate_dust(self, target_address):
        """Aggregate dust from all chains to target address"""
        print(f"\n🔄 Aggregating dust to {target_address}...")
        
        results = []
        
        for chain_name, conn in self.connections.items():
            w3 = conn['w3']
            config = conn['config']
            
            try:
                balance_wei = w3.eth.get_balance(self.address)
                balance = w3.from_wei(balance_wei, 'ether')
                
                if float(balance) <= 0:
                    print(f"  {chain_name}: No balance to transfer")
                    continue
                
                # Estimate gas
                gas_cost = self.estimate_gas_cost(chain_name, balance_wei)
                
                if balance_wei <= gas_cost:
                    print(f"  {chain_name}: Balance too low to cover gas")
                    continue
                
                # Calculate amount to transfer (balance - gas)
                amount_to_send = balance_wei - gas_cost
                
                # Create transaction
                tx = {
                    'nonce': w3.eth.get_transaction_count(self.address),
                    'to': Web3.to_checksum_address(target_address),
                    'value': amount_to_send,
                    'gas': 21000,
                    'gasPrice': w3.eth.gas_price,
                    'chainId': config['chain_id']
                }
                
                # Sign transaction
                signed_tx = w3.eth.account.sign_transaction(tx, self.private_key)
                
                # Send transaction (commented out for safety)
                # tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                # print(f"  {chain_name}: Transaction sent - {tx_hash.hex()}")
                
                results.append({
                    'chain': chain_name,
                    'amount': str(w3.from_wei(amount_to_send, 'ether')),
                    'symbol': config['symbol'],
                    'tx_hash': 'SIMULATED',
                    'status': 'ready'
                })
                
                print(f"  {chain_name}: Ready to send {w3.from_wei(amount_to_send, 'ether')} {config['symbol']}")
                
            except Exception as e:
                print(f"  Error processing {chain_name}: {e}")
                results.append({
                    'chain': chain_name,
                    'error': str(e),
                    'status': 'error'
                })
        
        return results
    
    def generate_report(self, balances, aggregation_results):
        """Generate final report"""
        report = {
            'address': self.address,
            'target_chain': self.target_chain,
            'balances': balances,
            'aggregation': aggregation_results,
            'total_value': sum(
                b['balance'] for b in balances.values()
            )
        }
        
        return report


def main():
    print("="*50)
    print("EIP-7702 Dust Aggregator Tool")
    print("="*50)
    
    # Get private key from environment or prompt
    private_key = os.environ.get('PRIVATE_KEY')
    if not private_key:
        print("\n⚠️  Set PRIVATE_KEY environment variable")
        print("   export PRIVATE_KEY=your_private_key_here")
        print("   Or add it to .env file")
        return
    
    # Target address for aggregation
    target_address = os.environ.get('TARGET_ADDRESS')
    if not target_address:
        print("\n⚠️  Set TARGET_ADDRESS environment variable")
        print("   export TARGET_ADDRESS=your_target_address_here")
        print("   Or add it to .env file")
        return
    
    # Get minimum balance
    min_balance = float(os.environ.get('MIN_BALANCE', '0.0001'))
    
    # Get target chain
    target_chain = os.environ.get('TARGET_CHAIN', 'ethereum')
    
    # Initialize aggregator
    aggregator = DustAggregator(private_key, target_chain)
    
    print(f"\n🔑 Wallet Address: {aggregator.address}")
    print(f"🎯 Target Chain: {target_chain}")
    print(f"🎯 Target Address: {target_address}")
    
    # Connect to chains
    print("\n📡 Connecting to chains...")
    aggregator.connect_to_chains()
    
    if not aggregator.connections:
        print("\n❌ No chains connected. Exiting.")
        return
    
    # Get balances
    print(f"\n💰 Checking balances (min: {min_balance})...")
    balances = aggregator.get_balances(min_balance=min_balance)
    
    if not balances:
        print("\n❌ No dust found. Exiting.")
        return
    
    # Aggregate dust
    results = aggregator.aggregate_dust(target_address)
    
    # Generate report
    report = aggregator.generate_report(balances, results)
    
    # Save report
    report_path = '/root/eip7702-dust-aggregator/report.json'
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print("\n" + "="*50)
    print(f"📊 Report saved to {report_path}")
    print("="*50)
    print(f"\nTotal chains scanned: {len(aggregator.connections)}")
    print(f"Chains with dust: {len(balances)}")
    print(f"Total value: ${report['total_value']:.2f}")
    print("\n⚠️  Transactions are in SIMULATION mode")
    print("   Uncomment send_raw_transaction to execute")


if __name__ == '__main__':
    main()
