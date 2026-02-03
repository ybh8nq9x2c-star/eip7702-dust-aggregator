@app.route('/api/estimate', methods=['POST'])
def estimate_sweep():
    """Estimate costs for EIP-7702 sponsored sweep"""
    try:
        data = request.get_json() or {}
        balances = data.get('balances', [])
        from_address = data.get('from_address', '')
        to_address = data.get('to_address', '')
        dest_chain_key = data.get('destination_chain', 'ethereum')
        
        # Validate addresses
        if not from_address or len(from_address) != 42:
            return jsonify({"error": "Invalid from address"}), 400
        if not to_address or len(to_address) != 42:
            return jsonify({"error": "Invalid to address"}), 400
        if dest_chain_key not in CHAINS:
            return jsonify({"error": "Invalid destination chain"}), 400
        
        dest_chain = CHAINS[dest_chain_key]
        
        estimates = []
        total_transfer_usd = 0.0
        total_gas_cost_usd = 0.0
        total_service_fee_usd = 0.0
        
        for bal in balances:
            balance_wei = int(bal.get('balance_wei', '0') or '0')
            chain_key = bal.get('key', '')
            balance_usd = bal.get('balance_usd', 0)
            
            # Skip low balances
            if balance_wei < 10000000000000:  # Less than 0.00001 ETH
                continue
            
            if chain_key == dest_chain_key:
                # Same chain - no gas cost needed
                gas_cost_wei = 0
                gas_cost_usd = 0
            else:
                # Different chain - estimate gas
                gas_info = estimate_gas_costs(chain_key, balance_wei, to_address)
                if not gas_info:
                    continue
                
                gas_cost_wei = gas_info['gas_cost_wei']
                gas_cost_usd = gas_info['gas_cost_eth'] * get_token_price(CHAINS[chain_key]['symbol'])
            
            # Calculate service fee (5%, min $0.05, max $0.50)
            service_fee_usd = calculate_service_fee(balance_usd - gas_cost_usd)
            service_fee_wei = int(service_fee_usd * 1e18 / get_token_price(CHAINS[dest_chain]['symbol']))
            
            # Calculate net transfer
            net_usd = balance_usd - gas_cost_usd - service_fee_usd
            net_wei = int(balance_wei * max(0, net_usd / balance_usd)) if balance_wei > 0 else 0
            
            if net_usd > 0:
                estimates.append({
                    "chain_key": chain_key,
                    "chain_name": bal['name'],
                    "chain_id": bal['chain_id'],
                    "from_chain": bal['name'],
                    "to_chain": dest_chain['name'],
                    "balance_wei": balance_wei,
                    "balance_eth": bal['balance'],
                    "balance_usd": balance_usd,
                    "gas_cost_wei": gas_cost_wei,
                    "gas_cost_eth": gas_cost_wei / 1e18,
                    "gas_cost_usd": gas_cost_usd,
                    "service_fee_usd": service_fee_usd,
                    "service_fee_wei": service_fee_wei,
                    "net_usd": net_usd,
                    "net_eth": net_wei / 1e18,
                    "net_wei": net_wei
                })
                
                total_transfer_usd += net_usd
                total_gas_cost_usd += gas_cost_usd
                total_service_fee_usd += service_fee_usd
        
        return jsonify({
            "destination": to_address,
            "destination_chain": dest_chain['name'],
            "estimates": estimates,
            "summary": {
                "total_balance_usd": round(sum(b.get('balance_usd', 0) for b in estimates), 2),
                "total_gas_cost_usd": round(total_gas_cost_usd, 2),
                "total_service_fee_usd": round(total_service_fee_usd, 2),
                "total_fees_usd": round(total_gas_cost_usd + total_service_fee_usd, 2),
                "total_transfer_usd": round(total_transfer_usd, 2),
                "count": len(estimates)
            },
            "sponsor": SPONSOR_ADDRESS,
            "note": "Sponsor pays gas - you only pay network costs + 5% service fee"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

