import sys
sys.path.insert(0, '.')

# Test the estimate endpoint with detailed logging
import json
from app import app, CHAINS, SPONSOR_ADDRESS, get_token_price, calculate_service_fee, estimate_gas_costs

print("🔍 Testing /api/estimate endpoint...")
print(f"CHAINS keys: {list(CHAINS.keys())[:5]}...")
print(f"SPONSOR_ADDRESS type: {type(SPONSOR_ADDRESS)}")

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
    
    print(f"\n📊 Test data:")
    for key, value in test_data.items():
        if key != 'balances':
            print(f"  {key}: {value} (type: {type(value).__name__})")
    print(f"  balances: {len(test_data['balances'])} items")
    
    print(f"\n🔧 Testing individual functions...")
    
    # Test balance iteration
    for i, bal in enumerate(test_data['balances']):
        print(f"\n  Balance {i}:")
        for key, value in bal.items():
            print(f"    {key}: {value} (type: {type(value).__name__})")
    
    # Test gas costs function
    print(f"\n  Testing estimate_gas_costs...")
    gas_info = estimate_gas_costs('ethereum', 100000000000000000, test_data['to_address'])
    print(f"  Result: {gas_info}")
    
    # Test get_token_price
    print(f"\n  Testing get_token_price...")
    price = get_token_price('ETH')
    print(f"  ETH Price: {price} (type: {type(price).__name__})")
    
    # Test the API call
    print(f"\n🌐 Calling /api/estimate...")
    response = client.post('/api/estimate', 
                          json=test_data,
                          content_type='application/json')
    
    print(f"\nStatus: {response.status_code}")
    print(f"Response: {json.dumps(response.get_json(), indent=2, default=str)}")

print("\n✅ Debug complete")
