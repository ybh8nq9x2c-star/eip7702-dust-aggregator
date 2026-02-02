// EIP-7702 Dust Aggregator - Gas.zip Style

class DustAggregator {
    constructor() {
        this.walletAddress = null;
        this.chains = [];
        this.balances = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadChains();
    }

    bindEvents() {
        document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
        document.getElementById('disconnectWallet').addEventListener('click', () => this.disconnectWallet());
        document.getElementById('scanBalances').addEventListener('click', () => this.scanBalances());
        document.getElementById('aggregateDust').addEventListener('click', () => this.aggregateDust());
        document.getElementById('closeError').addEventListener('click', () => this.hideError());
    }

    async loadChains() {
        try {
            const response = await fetch('/api/chains');
            const data = await response.json();
            this.chains = data.chains;
        } catch (error) {
            console.error('Error loading chains:', error);
        }
    }

    async connectWallet() {
        try {
            if (!window.ethereum) {
                this.showError('Please install MetaMask or another Web3 wallet');
                return;
            }

            const provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.send('eth_requestAccounts', []);
            
            this.walletAddress = accounts[0];
            this.updateWalletUI();
            this.showMainContent();
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showError('Failed to connect wallet: ' + error.message);
        }
    }

    disconnectWallet() {
        this.walletAddress = null;
        this.balances = [];
        this.hideWalletUI();
        this.hideMainContent();
    }

    updateWalletUI() {
        const address = this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4);
        document.getElementById('walletAddress').textContent = address;
        document.getElementById('walletBanner').classList.remove('hidden');
        document.getElementById('connectWallet').classList.add('hidden');
    }

    hideWalletUI() {
        document.getElementById('walletBanner').classList.add('hidden');
        document.getElementById('connectWallet').classList.remove('hidden');
    }

    showMainContent() {
        document.getElementById('mainContent').classList.remove('hidden');
    }

    hideMainContent() {
        document.getElementById('mainContent').classList.add('hidden');
    }

    async scanBalances() {
        if (!this.walletAddress) {
            this.showError('Please connect your wallet first');
            return;
        }

        this.showLoading('Scanning balances across all chains...');

        try {
            const response = await fetch('/api/balances', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ address: this.walletAddress })
            });

            if (!response.ok) {
                throw new Error('Failed to scan balances');
            }

            const data = await response.json();
            this.balances = data.balances;
            
            this.updateBalancesUI(data);
            this.hideLoading();
        } catch (error) {
            console.error('Error scanning balances:', error);
            this.hideLoading();
            this.showError('Failed to scan balances: ' + error.message);
        }
    }

    updateBalancesUI(data) {
        // Update stats
        document.getElementById('chainsWithBalance').textContent = data.chains_with_balance;

        // Show balances section if there are balances
        if (this.balances.length > 0) {
            document.getElementById('balancesSection').classList.remove('hidden');
            document.getElementById('aggregateSection').classList.remove('hidden');
            
            // Render balances
            const balancesList = document.getElementById('balancesList');
            balancesList.innerHTML = '';

            this.balances.forEach(balance => {
                const card = document.createElement('div');
                card.className = 'balance-card';
                card.innerHTML = `
                    <div class="balance-chain">
                        <div class="chain-icon" style="background: ${balance.color}">
                            ${balance.symbol[0]}
                        </div>
                        <div class="chain-name">${balance.chain}</div>
                    </div>
                    <div class="balance-amount">${balance.balance.toFixed(4)}</div>
                    <div class="balance-symbol">${balance.symbol}</div>
                `;
                balancesList.appendChild(card);
            });

            // Calculate totals
            const total = this.balances.reduce((sum, b) => sum + b.balance, 0);
            const fee = total * 0.05;
            const youReceive = total - fee;

            document.getElementById('totalBalance').textContent = total.toFixed(4);
            document.getElementById('estimatedFee').textContent = fee.toFixed(4);
            document.getElementById('youReceive').textContent = youReceive.toFixed(4);
        } else {
            this.showError('No dust balances found across any chain');
        }
    }

    async aggregateDust() {
        const targetAddress = document.getElementById('targetAddress').value;

        if (!targetAddress) {
            this.showError('Please enter a destination address');
            return;
        }

        if (!ethers.isAddress(targetAddress)) {
            this.showError('Invalid destination address');
            return;
        }

        this.showLoading('Aggregating dust...');

        try {
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

            if (!response.ok) {
                throw new Error('Failed to aggregate dust');
            }

            const data = await response.json();
            this.updateResultsUI(data);
            this.hideLoading();
        } catch (error) {
            console.error('Error aggregating dust:', error);
            this.hideLoading();
            this.showError('Failed to aggregate dust: ' + error.message);
        }
    }

    updateResultsUI(data) {
        document.getElementById('resultsSection').classList.remove('hidden');
        
        const resultsList = document.getElementById('resultsList');
        resultsList.innerHTML = '';

        data.transactions.forEach(tx => {
            const card = document.createElement('div');
            card.className = 'result-card';
            card.innerHTML = `
                <div class="result-info">
                    <div class="chain-icon" style="background: ${tx.color}">
                        ${tx.symbol[0]}
                    </div>
                    <div>
                        <div class="chain-name">${tx.chain}</div>
                        <div class="balance-amount">${tx.amount.toFixed(4)} ${tx.symbol}</div>
                    </div>
                </div>
                <div class="result-status ${tx.status}">${tx.status}</div>
            `;
            resultsList.appendChild(card);
        });
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

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DustAggregator();
});
