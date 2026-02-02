// EIP-7702 Dust Aggregator - WalletConnect Implementation

class DustAggregatorApp {
    constructor() {
        this.walletAddress = null;
        this.chainId = null;
        this.provider = null;
        this.signer = null;
        this.balances = [];
        this.chains = [];
        this.web3Modal = null;
        this.init();
    }

    async init() {
        console.log('Initializing EIP-7702 Dust Aggregator...');
        
        // Initialize Web3Modal
        await this.initWeb3Modal();
        
        // Fetch chains configuration
        await this.fetchChains();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Check if wallet is already connected
        await this.checkWalletConnection();
        
        console.log('EIP-7702 Dust Aggregator initialized successfully!');
    }

    async initWeb3Modal() {
        try {
            // Configure Web3Modal
            const projectId = 'YOUR_PROJECT_ID'; // Replace with your WalletConnect Project ID
            
            // For demo purposes, we'll use a simpler approach with window.ethereum
            if (typeof window.ethereum !== 'undefined') {
                this.provider = window.ethereum;
                console.log('MetaMask detected');
            } else {
                console.log('No wallet detected');
            }
        } catch (error) {
            console.error('Failed to initialize Web3Modal:', error);
        }
    }

    async fetchChains() {
        try {
            const response = await fetch('/api/chains');
            const data = await response.json();
            this.chains = data.chains;
            console.log('Chains loaded:', this.chains.length);
        } catch (error) {
            console.error('Failed to fetch chains:', error);
            this.showError('Failed to load chain configuration');
        }
    }

    setupEventListeners() {
        // Connect wallet button
        const connectButton = document.getElementById('connectWallet');
        if (connectButton) {
            connectButton.addEventListener('click', () => this.connectWallet());
        }

        // Disconnect wallet button
        const disconnectButton = document.getElementById('disconnectWallet');
        if (disconnectButton) {
            disconnectButton.addEventListener('click', () => this.disconnectWallet());
        }

        // Scan balances button
        const scanButton = document.getElementById('scanBalances');
        if (scanButton) {
            scanButton.addEventListener('click', () => this.scanBalances());
        }

        // Aggregate dust button
        const aggregateButton = document.getElementById('aggregateDust');
        if (aggregateButton) {
            aggregateButton.addEventListener('click', () => this.aggregateDust());
        }

        // Close error button
        const closeErrorButton = document.getElementById('closeError');
        if (closeErrorButton) {
            closeErrorButton.addEventListener('click', () => this.hideError());
        }

        // Listen for account changes
        if (this.provider) {
            this.provider.on('accountsChanged', (accounts) => {
                if (accounts.length > 0) {
                    this.walletAddress = accounts[0];
                    this.updateWalletUI();
                } else {
                    this.disconnectWallet();
                }
            });

            // Listen for chain changes
            this.provider.on('chainChanged', (chainId) => {
                this.chainId = parseInt(chainId);
                console.log('Chain changed to:', this.chainId);
            });
        }
    }

    async checkWalletConnection() {
        try {
            if (this.provider) {
                const accounts = await this.provider.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    this.walletAddress = accounts[0];
                    this.chainId = await this.provider.request({ method: 'eth_chainId' });
                    this.chainId = parseInt(this.chainId);
                    this.updateWalletUI();
                }
            }
        } catch (error) {
            console.error('Failed to check wallet connection:', error);
        }
    }

    async connectWallet() {
        try {
            this.showLoading('Connecting wallet...');
            
            if (!this.provider) {
                throw new Error('No wallet detected. Please install MetaMask or another Web3 wallet.');
            }

            // Request account access
            const accounts = await this.provider.request({ method: 'eth_requestAccounts' });
            this.walletAddress = accounts[0];
            
            // Get chain ID
            this.chainId = await this.provider.request({ method: 'eth_chainId' });
            this.chainId = parseInt(this.chainId);
            
            // Create ethers provider and signer
            this.ethersProvider = new ethers.BrowserProvider(this.provider);
            this.signer = await this.ethersProvider.getSigner();
            
            this.updateWalletUI();
            this.hideLoading();
            
            console.log('Wallet connected:', this.walletAddress);
        } catch (error) {
            this.hideLoading();
            console.error('Failed to connect wallet:', error);
            this.showError(error.message || 'Failed to connect wallet');
        }
    }

    async disconnectWallet() {
        try {
            this.walletAddress = null;
            this.chainId = null;
            this.signer = null;
            this.balances = [];
            
            this.updateWalletUI();
            
            // Hide main content
            document.getElementById('mainContent').classList.add('hidden');
            document.getElementById('balancesSection').classList.add('hidden');
            document.getElementById('aggregateSection').classList.add('hidden');
            document.getElementById('resultsSection').classList.add('hidden');
            
            console.log('Wallet disconnected');
        } catch (error) {
            console.error('Failed to disconnect wallet:', error);
        }
    }

    updateWalletUI() {
        const walletBanner = document.getElementById('walletBanner');
        const walletAddress = document.getElementById('walletAddress');
        const mainContent = document.getElementById('mainContent');
        
        if (this.walletAddress) {
            // Show wallet banner
            walletBanner.classList.remove('hidden');
            
            // Display truncated address
            const truncatedAddress = `${this.walletAddress.slice(0, 6)}...${this.walletAddress.slice(-4)}`;
            walletAddress.textContent = truncatedAddress;
            
            // Show main content
            mainContent.classList.remove('hidden');
        } else {
            // Hide wallet banner
            walletBanner.classList.add('hidden');
            
            // Hide main content
            mainContent.classList.add('hidden');
        }
    }

    async scanBalances() {
        try {
            if (!this.walletAddress) {
                throw new Error('Please connect your wallet first');
            }

            this.showLoading('Scanning balances across all chains...');
            
            const response = await fetch('/api/balances', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: this.walletAddress
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.balances = data.balances;
            this.displayBalances();
            this.hideLoading();
            
            console.log('Balances scanned:', this.balances);
        } catch (error) {
            this.hideLoading();
            console.error('Failed to scan balances:', error);
            this.showError(error.message || 'Failed to scan balances');
        }
    }

    displayBalances() {
        const balancesSection = document.getElementById('balancesSection');
        const balancesList = document.getElementById('balancesList');
        const totalBalance = document.getElementById('totalBalance');
        const estimatedFee = document.getElementById('estimatedFee');
        const youReceive = document.getElementById('youReceive');
        
        // Show balances section
        balancesSection.classList.remove('hidden');
        
        // Clear previous results
        balancesList.innerHTML = '';
        
        let total = 0;
        
        // Display each balance
        this.balances.forEach(balance => {
            if (balance.balance > 0) {
                total += balance.balance;
                
                const card = document.createElement('div');
                card.className = 'balance-card';
                card.innerHTML = `
                    <div class="balance-header">
                        <span class="chain-name">${balance.chain}</span>
                        <span class="balance-amount">${balance.balance.toFixed(6)} ${balance.symbol}</span>
                    </div>
                    <div class="balance-details">
                        <div>Address: ${balance.address.slice(0, 8)}...${balance.address.slice(-6)}</div>
                    </div>
                `;
                balancesList.appendChild(card);
            }
        });
        
        // Calculate fee and final amount
        const fee = total * 0.05;
        const finalAmount = total - fee;
        
        // Update summary
        totalBalance.textContent = `${total.toFixed(6)} ETH`;
        estimatedFee.textContent = `${fee.toFixed(6)} ETH`;
        youReceive.textContent = `${finalAmount.toFixed(6)} ETH`;
        
        // Show aggregate section if there are balances
        const aggregateSection = document.getElementById('aggregateSection');
        if (total > 0) {
            aggregateSection.classList.remove('hidden');
            
            // Pre-fill target address with connected wallet address
            const targetAddress = document.getElementById('targetAddress');
            targetAddress.value = this.walletAddress;
        } else {
            aggregateSection.classList.add('hidden');
        }
    }

    async aggregateDust() {
        try {
            if (!this.walletAddress) {
                throw new Error('Please connect your wallet first');
            }

            const targetAddress = document.getElementById('targetAddress').value;
            
            if (!targetAddress || !ethers.isAddress(targetAddress)) {
                throw new Error('Please enter a valid destination address');
            }

            this.showLoading('Aggregating dust...');
            
            const response = await fetch('/api/aggregate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    address: this.walletAddress,
                    target_address: targetAddress
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.displayResults(data.transactions);
            this.hideLoading();
            
            console.log('Dust aggregated:', data.transactions);
        } catch (error) {
            this.hideLoading();
            console.error('Failed to aggregate dust:', error);
            this.showError(error.message || 'Failed to aggregate dust');
        }
    }

    displayResults(transactions) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsList = document.getElementById('resultsList');
        
        // Show results section
        resultsSection.classList.remove('hidden');
        
        // Clear previous results
        resultsList.innerHTML = '';
        
        // Display each transaction
        transactions.forEach(tx => {
            const card = document.createElement('div');
            card.className = `result-card ${tx.status}`;
            card.innerHTML = `
                <div class="result-header">
                    <span class="chain-name">${tx.chain}</span>
                    <span class="status ${tx.status}">${tx.status}</span>
                </div>
                <div class="result-details">
                    <div class="detail-row">
                        <span class="label">Amount:</span>
                        <span class="value">${tx.amount.toFixed(6)} ${tx.symbol}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">To:</span>
                        <span class="value">${tx.to.slice(0, 8)}...${tx.to.slice(-6)}</span>
                    </div>
                    ${tx.tx_hash ? `
                    <div class="detail-row">
                        <span class="label">Transaction:</span>
                        <span class="value tx-hash">${tx.tx_hash.slice(0, 10)}...${tx.tx_hash.slice(-8)}</span>
                    </div>
                    ` : ''}
                </div>
            `;
            resultsList.appendChild(card);
        });
    }

    showLoading(text) {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loadingText');
        loadingText.textContent = text;
        loading.classList.remove('hidden');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        loading.classList.add('hidden');
    }

    showError(message) {
        const error = document.getElementById('error');
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = message;
        error.classList.remove('hidden');
    }

    hideError() {
        const error = document.getElementById('error');
        error.classList.add('hidden');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DustAggregatorApp();
});
