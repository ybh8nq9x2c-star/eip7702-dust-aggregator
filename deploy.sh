#!/bin/bash

# EIP-7702 Dust Aggregator Deployment Script

echo "========================================"
echo "EIP-7702 Dust Aggregator Deployment"
echo "========================================"

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✓ Python 3 found: $(python3 --version)"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "\n📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "\n✓ Virtual environment already exists"
fi

# Activate virtual environment
echo "\n🔧 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "\n⬆️  Upgrading pip..."
pip install --upgrade pip -q

# Install dependencies
echo "\n📥 Installing dependencies..."
pip install -r requirements.txt -q

# Check if installation was successful
if python3 -c "import web3" 2>/dev/null; then
    echo "✓ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "\n📝 Creating .env file..."
    cat > .env << 'ENVEOF'
# EIP-7702 Dust Aggregator Configuration
# ⚠️  NEVER share your private key!

# Your wallet private key (without 0x prefix)
PRIVATE_KEY=

# Target address for dust aggregation
TARGET_ADDRESS=

# Minimum balance to consider (in ETH)
MIN_BALANCE=0.0001

# Chain to aggregate to (ethereum, polygon, bsc, arbitrum, optimism)
TARGET_CHAIN=ethereum
ENVEOF
    echo "✓ .env file created"
    echo "\n⚠️  IMPORTANT: Edit .env file and add your PRIVATE_KEY and TARGET_ADDRESS"
else
    echo "\n✓ .env file already exists"
fi

echo "\n========================================"
echo "✅ Deployment completed successfully!"
echo "========================================"
echo "\nNext steps:"
echo "1. Edit .env file and add your credentials"
echo "2. Run: python dust_aggregator.py"
echo "3. Check report.json for results"
echo "\n⚠️  WARNING: Never share your private key!"
echo "========================================"
