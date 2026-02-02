// EIP-7702 Dust Aggregator - Web3 Wallet Connection

class DustAggregator {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.chains = {};
        this.balances = {};
        this.feePercentage = 0.05;
        this.feeAddress = '0xFc20B3A46aD9DAD7d4656bB52C1B13CA042cd2f1';
        
        this.init();
    }
    
    async init() {
        try {
            // Load chains configuration
            await this.loadChains();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Check if wallet is already connected
            if (window.ethereum) {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.connectWallet();
                }
            }
        } catch (error) {
            this.showError('Failed to initialize: ' + error.message);
        }
    }
    
    async loadChains() {
        try {
            const response = await fetch('/api/chains');
            const data = await response.json();
            this.chains = data.chains;
            this.feePercentage = data.fee_percentage / 100;
            this.feeAddress = data.fee_address;
        } catch (error) {
            this.showError('Failed to load chains: ' + error.message);
        }
    }
    
    setupEventListeners() {
        // Connect wallet button
        document.getElementById('connectWallet').addEventListener('click', () => {
            this.connectWallet();
        });
        
        // Disconnect wallet button
        document.getElementById('disconnectWallet').addEventListener('click', () => {
            this.disconnectWallet();
        });
        
        // Scan balances button
        document.getElementById('scanBalances').addEventListener('click', () => {
            this.scanBalances();
        });
        
        // Aggregate dust button
        document.getElementById('aggregateDust').addEventListener('click', () => {
            this.aggregateDust();
        });
        
        // Close error button
        document.getElementById('closeError').addEventListener('click', () => {
            this.hideError();
        });
        
        // Handle account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.disconnectWallet();
                } else {
                    this.connectWallet();
                }
            });
            
            // Handle chain changes
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
        }
    }
    
    async connectWallet() {
        try {
            this.showLoading('Connecting wallet...');
            
            // Check if MetaMask is installed
            if (!window.ethereum) {
                throw new Error('Please install MetaMask or another Web3 wallet');
            }
            
            // Request account access
            this.provider = new ethers.BrowserProvider(window.ethereum);
            this.signer = await this.provider.getSigner();
            this.address = await this.signer.getAddress();
            
            // Update UI
            document.getElementById('connectWallet').classList.add('hidden');
            document.getElementById('walletInfo').classList.remove('hidden');
            document.getElementById('walletAddress').textContent = 
                this.address.substring(0, 6) + '...' + this.address.substring(38);
            document.getElementById('mainContent').classList.remove('hidden');
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to connect wallet: ' + error.message);
        }
    }
    
    disconnectWallet() {
        this.provider = null;
        this.signer = null;
        this.address = null;
        this.balances = {};
        
        // Update UI
        document.getElementById('connectWallet').classList.remove('hidden');
        document.getElementById('walletInfo').classList.add('hidden');
        document.getElementById('mainContent').classList.add('hidden');
        document.getElementById('balancesSection').classList.add('hidden');
        document.getElementById('aggregateSection').classList.add('hidden');
        document.getElementById('resultsSection').classList.add('hidden');
    }
    
    async scanBalances() {
        try {
            this.showLoading('Scanning balances across all chains...');
            
            this.balances = {};
            let totalBalance = 0;
            
            // Scan each chain
            for (const [chainName, config] of Object.entries(this.chains)) {
                try {
                    const provider = new ethers.JsonRpcProvider(config.rpc);
                    const balance = await provider.getBalance(this.address);
                    const balanceEth = parseFloat(ethers.formatEther(balance));
                    
                    if (balanceEth > 0.0001) {
                        this.balances[chainName] = {
                            balance: balanceEth,
                            balanceWei: balance,
                            symbol: config.symbol,
                            chainId: config.chain_id,
                            name: config.name,
                            color: config.color
                        };
                        totalBalance += balanceEth;
                    }
                } catch (error) {
                    console.error(`Failed to scan ${chainName}:`, error);
                }
            }
            
            // Update UI
            this.displayBalances();
            this.updateTotals(totalBalance);
            
            document.getElementById('balancesSection').classList.remove('hidden');
            document.getElementById('aggregateSection').classList.remove('hidden');
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to scan balances: ' + error.message);
        }
    }
    
    displayBalances() {
        const balancesList = document.getElementById('balancesList');
        balancesList.innerHTML = '';
        
        for (const [chainName, balance] of Object.entries(this.balances)) {
            const balanceItem = document.createElement('div');
            balanceItem.className = 'balance-item';
            balanceItem.innerHTML = `
                <div class="balance-header">
                    <span class="chain-name" style="color: ${balance.color}">${balance.name}</span>
                    <span class="balance-amount">${balance.balance.toFixed(6)} ${balance.symbol}</span>
                </div>
                <div class="balance-details">
                    <span class="chain-id">Chain ID: ${balance.chainId}</span>
                </div>
            `;
            balancesList.appendChild(balanceItem);
        }
    }
    
    updateTotals(totalBalance) {
        const estimatedFee = totalBalance * this.feePercentage;
        const youReceive = totalBalance - estimatedFee;
        
        document.getElementById('totalBalance').textContent = totalBalance.toFixed(6) + ' ETH';
        document.getElementById('estimatedFee').textContent = estimatedFee.toFixed(6) + ' ETH';
        document.getElementById('youReceive').textContent = youReceive.toFixed(6) + ' ETH';
    }
    
    async aggregateDust() {
        try {
            const targetAddress = document.getElementById('targetAddress').value;
            
            if (!targetAddress) {
                throw new Error('Please enter a target address');
            }
            
            if (!ethers.isAddress(targetAddress)) {
                throw new Error('Invalid target address');
            }
            
            this.showLoading('Aggregating dust...');
            
            const results = [];
            let totalAggregated = 0;
            let totalFee = 0;
            
            // Aggregate from each chain
            for (const [chainName, balance] of Object.entries(this.balances)) {
                try {
                    const config = this.chains[chainName];
                    const provider = new ethers.JsonRpcProvider(config.rpc);
                    
                    // Estimate gas
                    const gasPrice = await provider.getFeeData();
                    const gasLimit = 21000n;
                    const gasCost = gasPrice.gasPrice * gasLimit;
                    
                    if (balance.balanceWei <= gasCost) {
                        continue;
                    }
                    
                    // Calculate amounts
                    const amountAfterGas = balance.balanceWei - gasCost;
                    const feeAmount = amountAfterGas * BigInt(Math.floor(this.feePercentage * 100)) / 100n;
                    const amountToUser = amountAfterGas - feeAmount;
                    
                    if (amountToUser <= 0n) {
                        continue;
                    }
                    
                    // Request user to switch to the chain
                    try {
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: '0x' + config.chain_id.toString(16) }]
                        });
                    } catch (switchError) {
                        // This error code indicates that the chain has not been added to MetaMask
                        if (switchError.code === 4902) {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: '0x' + config.chain_id.toString(16),
                                    chainName: config.name,
                                    nativeCurrency: {
                                        name: config.symbol,
                                        symbol: config.symbol,
                                        decimals: 18
                                    },
                                    rpcUrls: [config.rpc]
                                }]
                            });
                        } else {
                            throw switchError;
                        }
                    }
                    
                    // Create and send transaction to user
                    const txUser = {
                        to: targetAddress,
                        value: amountToUser,
                        gasLimit: gasLimit
                    };
                    
                    const txResponseUser = await this.signer.sendTransaction(txUser);
                    
                    // Create and send fee transaction
                    const txFee = {
                        to: this.feeAddress,
                        value: feeAmount,
                        gasLimit: gasLimit
                    };
                    
                    const txResponseFee = await this.signer.sendTransaction(txFee);
                    
                    results.push({
                        chain: chainName,
                        name: config.name,
                        symbol: config.symbol,
                        color: config.color,
                        originalBalance: balance.balance,
                        gasCost: parseFloat(ethers.formatEther(gasCost)),
                        feeAmount: parseFloat(ethers.formatEther(feeAmount)),
                        userAmount: parseFloat(ethers.formatEther(amountToUser)),
                        totalSent: parseFloat(ethers.formatEther(amountAfterGas)),
                        status: 'success',
                        txHashUser: txResponseUser.hash,
                        txHashFee: txResponseFee.hash
                    });
                    
                    totalAggregated += parseFloat(ethers.formatEther(amountToUser));
                    totalFee += parseFloat(ethers.formatEther(feeAmount));
                    
                } catch (error) {
                    results.push({
                        chain: chainName,
                        error: error.message,
                        status: 'error'
                    });
                }
            }
            
            // Display results
            this.displayResults(results, totalAggregated, totalFee);
            
            document.getElementById('resultsSection').classList.remove('hidden');
            
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to aggregate dust: ' + error.message);
        }
    }
    
    displayResults(results, totalAggregated, totalFee) {
        const resultsList = document.getElementById('resultsList');
        resultsList.innerHTML = '';
        
        for (const result of results) {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item ' + result.status;
            
            if (result.status === 'success') {
                resultItem.innerHTML = `
                    <div class="result-header">
                        <span class="chain-name" style="color: ${result.color}">${result.name}</span>
                        <span class="status success">✅ Success</span>
                    </div>
                    <div class="result-details">
                        <div class="detail-row">
                            <span class="label">Original Balance:</span>
                            <span class="value">${result.originalBalance.toFixed(6)} ${result.symbol}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Gas Cost:</span>
                            <span class="value">${result.gasCost.toFixed(6)} ${result.symbol}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">Fee (5%):</span>
                            <span class="value">${result.feeAmount.toFixed(6)} ${result.symbol}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">You Received:</span>
                            <span class="value">${result.userAmount.toFixed(6)} ${result.symbol}</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">TX Hash (User):</span>
                            <span class="value tx-hash">${result.txHashUser.substring(0, 10)}...</span>
                        </div>
                        <div class="detail-row">
                            <span class="label">TX Hash (Fee):</span>
                            <span class="value tx-hash">${result.txHashFee.substring(0, 10)}...</span>
                        </div>
                    </div>
                `;
            } else {
                resultItem.innerHTML = `
                    <div class="result-header">
                        <span class="chain-name">${result.chain}</span>
                        <span class="status error">❌ Error</span>
                    </div>
                    <div class="result-details">
                        <div class="detail-row">
                            <span class="label">Error:</span>
                            <span class="value">${result.error}</span>
                        </div>
                    </div>
                `;
            }
            
            resultsList.appendChild(resultItem);
        }
        
        // Add summary
        const summaryItem = document.createElement('div');
        summaryItem.className = 'result-item summary';
        summaryItem.innerHTML = `
            <div class="result-header">
                <span class="chain-name">Summary</span>
            </div>
            <div class="result-details">
                <div class="detail-row">
                    <span class="label">Total Aggregated:</span>
                    <span class="value">${totalAggregated.toFixed(6)} ETH</span>
                </div>
                <div class="detail-row">
                    <span class="label">Total Fee:</span>
                    <span class="value">${totalFee.toFixed(6)} ETH</span>
                </div>
            </div>
        `;
        resultsList.appendChild(summaryItem);
    }
    
    showLoading(text) {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loading').classList.remove('hidden');
    }
    
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }
    
    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('error').classList.remove('hidden');
    }
    
    hideError() {
        document.getElementById('error').classList.add('hidden');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DustAggregator();
});
