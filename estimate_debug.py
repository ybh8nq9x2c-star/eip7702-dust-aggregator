import sys
sys.path.insert(0, '.')

import json
import traceback
from app import app, CHAINS, SPONSOR_ADDRESS, get_token_price, calculate_service_fee, estimate_gas_costs

print("🔍 DEBUGGING /api/estimate endpoint...")

with app.test_client() as client:
    test_data = {
        'balances': [
            {
                'key': 'ethereum',
                'balance': '0.1',
                'balance_wei': '100000000000000000',
                'balance_usd': 350,
                'name': 'Ethereum',
                'chain_id': 1,
                'symbol': 'ETH'
            }
        ],
        'from_address': '0xc928ce592ccd2c457facc7e8d7b60b2a75698c68',
        'to_address': '0xc928ce592ccd2c457facc7e8d7b60b2a75698c68',
        'destination_chain': 'ethereum'
    }
    
    print("\n📊 Step 1: Parse request data")
    try:
        data = test_data
        balances = data.get('balances', [])
        from_address = data.get('from_address', '')
        to_address = data.get('to_address', '')
        dest_chain_key = data.get('destination_chain', 'ethereum')
        print(f"  ✓ Parsed successfully")
        print(f"    balances: {len(balances)} items")
        print(f"    from_address: {from_address} (type: {type(from_address).__name__})")
        print(f"    to_address: {to_address} (type: {type(to_address).__name__})")
        print(f"    dest_chain_key: {dest_chain_key} (type: {type(dest_chain_key).__name__})")
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        traceback.print_exc()
    
    print("\n📊 Step 2: Get destination chain")
    try:
        dest_chain = CHAINS[dest_chain_key]
        print(f"  ✓ Got destination chain: {dest_chain['name']}")
    except Exception as e:
        print(f"  ❌ ERROR: {e}")
        traceback.print_exc()
    
    print("\n📊 Step 3: Iterate through balances")
    try:
        estimates = []
        total_transfer_usd = 0.0
        total_gas_cost_usd = 0.0
        total_service_fee_usd = 0.0
        
        for i, bal in enumerate(balances):
            print(f"  Processing balance {i}...")
            
            try:
                balance_wei = int(bal.get('balance_wei', '0') or '0')
                chain_key = bal.get('key', '')
                balance_usd = bal.get('balance_usd', 0)
                print(f"    ✓ balance_wei: {balance_wei}, chain_key: {chain_key}, balance_usd: {balance_usd}")
            except Exception as e:
                print(f"    ❌ ERROR parsing balance: {e}")
                traceback.print_exc()
                continue
            
            print(f"  Processing balance {i} - chain_key type: {type(chain_key).__name__}")
            print(f"  Processing balance {i} - dest_chain_key type: {type(dest_chain_key).__name__}")
            print(f"  Processing balance {i} - Comparing: {chain_key} == {dest_chain_key}")
            
            if chain_key == dest_chain_key:
                gas_cost_wei = 0
                gas_cost_usd = 0
                print(f"    ✓ Same chain, no gas cost")
            else:
                print(f"    Different chain, estimating gas...")
                gas_info = estimate_gas_costs(chain_key, balance_wei, to_address)
                print(f"    Gas info: {gas_info}")
                if not gas_info:
                    continue
                gas_cost_wei = gas_info['gas_cost_wei']
                gas_cost_usd = gas_info['gas_cost_eth'] * get_token_price(CHAINS[chain_key]['symbol'])
                print(f"    ✓ Gas cost: {gas_cost_usd} USD")
            
            service_fee_usd = calculate_service_fee(balance_usd - gas_cost_usd)
            service_fee_wei = int(service_fee_usd * 1e18 / get_token_price(CHAINS[dest_chain]['symbol']))
            net_usd = balance_usd - gas_cost_usd - service_fee_usd
            net_wei = int(balance_wei * max(0, net_usd / balance_usd)) if balance_wei > 0 else 0
            
            print(f"    ✓ Service fee: {service_fee_usd} USD, Net: {net_usd} USD")
            
            if net_usd > 0:
                estimate = {
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
                }
                print(f"    ✓ Creating estimate with keys: {list(estimate.keys())}")
                estimates.append(estimate)
                print(f"    ✓ Estimate added. Total estimates: {len(estimates)}")
                total_transfer_usd += net_usd
                total_gas_cost_usd += gas_cost_usd
                total_service_fee_usd += service_fee_usd
        
        print(f"  ✓ All balances processed. Estimates: {len(estimates)}")
    except Exception as e:
        print(f"  ❌ ERROR during processing: {e}")
        traceback.print_exc()
    
    print("\n📊 Step 4: Build summary")
    try:
        summary = {
            "total_balance_usd": round(sum(b.get('balance_usd', 0) for b in estimates), 2),
            "total_gas_cost_usd": round(total_gas_cost_usd, 2),
            "total_service_fee_usd": round(total_service_fee_usd, 2),
            "total_fees_usd": round(total_gas_cost_usd + total_service_fee_usd, 2),
            "total_transfer_usd": round(total_transfer_usd, 2),
            "count": len(estimates)
        }
        print(f"  ✓ Summary built: {summary}")
    except Exception as e:
        print(f"  ❌ ERROR building summary: {e}")
        traceback.print_exc()
    
    print("\n📊 Step 5: Build final response")
    try:
        response_dict = {
            "destination": to_address,
            "destination_chain": dest_chain['name'],
            "estimates": estimates,
            "summary": summary,
            "sponsor": SPONSOR_ADDRESS,
            "note": "Sponsor pays gas - you only pay network costs + 5% service fee"
        }
        print(f"  ✓ Response dict built with keys: {list(response_dict.keys())}")
    except Exception as e:
        print(f"  ❌ ERROR building response dict: {e}")
        traceback.print_exc()
    
    print("\n📊 Step 6: Serialize to JSON")
    try:
        json_str = json.dumps(response_dict, indent=2, default=str)
        print(f"  ✓ JSON serialized successfully")
        print(f"  JSON length: {len(json_str)} characters")
    except Exception as e:
        print(f"  ❌ ERROR serializing JSON: {e}")
        traceback.print_exc()

print("\n✅ Debug complete")
