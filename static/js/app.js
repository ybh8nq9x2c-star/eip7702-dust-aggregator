// EIP-7702 Dust Aggregator - Dust.zip Style

class DustAggregator {
    constructor() {
        this.walletAddress = null;
        this.chains = {};
        this.balances = [];
        this.transactions = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadChains();
    }

    bindEvents() {
        const connectBtn = document.getElementById('connectWallet');
        const disconnectBtn = document.getElementById('disconnectWallet');
        const scanBtn = document.getElementById('scanBalances');
        const aggregateBtn = document.getElementById('aggregateDust');
        const closeErrorBtn = document.getElementById('closeError');
        const addressInput = document.getElementById('walletAddressInput');

        if (connectBtn) connectBtn.addEventListener('click', () => this.connectWallet());
        if (disconnectBtn) disconnectBtn.addEventListener('click', () => this.disconnectWallet());
        if (scanBtn) scanBtn.addEventListener('click', () => this.scanBalances());
        if (aggregateBtn) aggregateBtn.addEventListener('click', () => this.aggregateDust());
        if (closeErrorBtn) closeErrorBtn.addEventListener('click', () => this.hideError());
        if (addressInput) {
            addressInput.addEventListener('input', (e) => {
                this.walletAddress = e.target.value.trim();
            });
        }
    }

    async loadChains() {
        try {
            const response = await fetch('/api/chains');
            const data = await response.json();
            this.chains = data.chains || {};
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

            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.walletAddress = accounts[0];
            
            const addressInput = document.getElementById('walletAddressInput');
            if (addressInput) addressInput.value = this.walletAddress;
            
            this.updateWalletUI();
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showError('Failed to connect wallet: ' + error.message);
        }
    }

    disconnectWallet() {
        this.walletAddress = null;
        this.balances = [];
        this.transactions = [];
        
        const addressInput = document.getElementById('walletAddressInput');
        if (addressInput) addressInput.value = '';
        
        this.hideWalletUI();
        this.hideBalances();
        this.hideResults();
    }

    updateWalletUI() {
        if (!this.walletAddress) return;
        
        const shortAddress = this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4);
        
        const walletAddressEl = document.getElementById('walletAddress');
        const walletBanner = document.getElementById('walletBanner');
        const connectBtn = document.getElementById('connectWallet');
        
        if (walletAddressEl) walletAddressEl.textContent = shortAddress;
        if (walletBanner) walletBanner.classList.remove('hidden');
        if (connectBtn) connectBtn.classList.add('hidden');
    }

    hideWalletUI() {
        const walletBanner = document.getElementById('walletBanner');
        const connectBtn = document.getElementById('connectWallet');
        
        if (walletBanner) walletBanner.classList.add('hidden');
        if (connectBtn) connectBtn.classList.remove('hidden');
    }

    hideBalances() {
        const balancesSection = document.getElementById('balancesSection');
        const aggregateSection = document.getElementById('aggregateSection');
        
        if (balancesSection) balancesSection.classList.add('hidden');
        if (aggregateSection) aggregateSection.classList.add('hidden');
    }

    hideResults() {
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) resultsSection.classList.add('hidden');
    }

    async scanBalances() {
        const addressInput = document.getElementById('walletAddressInput');
        const address = addressInput ? addressInput.value.trim() : '';

        if (!address) {
            this.showError('Please enter a wallet address or connect with MetaMask');
            return;
        }

        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
            this.showError('Invalid wallet address format');
            return;
        }

        this.walletAddress = address;
        this.showLoading('Scanning balances across 15 chains...');

        try {
            const response = await fetch('/api/balances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: this.walletAddress })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to scan balances');
            }

            this.balances = data.balances || [];
            this.updateBalancesUI(data);
            this.hideLoading();
        } catch (error) {
            console.error('Error scanning balances:', error);
            this.hideLoading();
            this.showError('Failed to scan balances: ' + error.message);
        }
    }

    updateBalancesUI(data) {
        const chainsEl = document.getElementById('chainsWithBalance');
        if (chainsEl) chainsEl.textContent = data.chains_with_balance || 0;

        if (this.balances.length > 0) {
            const balancesSection = document.getElementById('balancesSection');
            const aggregateSection = document.getElementById('aggregateSection');
            
            if (balancesSection) balancesSection.classList.remove('hidden');
            if (aggregateSection) aggregateSection.classList.remove('hidden');

            const balancesList = document.getElementById('balancesList');
            if (balancesList) {
                balancesList.innerHTML = '';
                
                this.balances.forEach(b => {
                    const balance = parseFloat(b.balance) || 0;
                    const card = document.createElement('div');
                    card.className = 'balance-card';
                    card.innerHTML = `
                        <div class="balance-chain">
                            <div class="chain-icon" style="background: ${b.color || '#627EEA'}">
                                ${(b.symbol || 'ETH')[0]}
                            </div>
                            <div class="chain-name">${b.chain || b.name || 'Unknown'}</div>
                        </div>
                        <div class="balance-amount">${balance.toFixed(6)}</div>
                        <div class="balance-symbol">${b.symbol || 'ETH'}</div>
                    `;
                    balancesList.appendChild(card);
                });
            }

            const total = data.total_balance || 0;
            const fee = data.total_fee || 0;
            const youReceive = data.total_after_fee || 0;

            const totalEl = document.getElementById('totalBalance');
            const feeEl = document.getElementById('estimatedFee');
            const receiveEl = document.getElementById('youReceive');
            
            if (totalEl) totalEl.textContent = total.toFixed(6);
            if (feeEl) feeEl.textContent = fee.toFixed(6);
            if (receiveEl) receiveEl.textContent = youReceive.toFixed(6);
        } else {
            this.showError('No dust balances found across any chain');
        }
    }

    async aggregateDust() {
        const targetInput = document.getElementById('targetAddress');
        const targetAddress = targetInput ? targetInput.value.trim() : '';

        if (!targetAddress) {
            this.showError('Please enter a destination address');
            return;
        }

        if (!targetAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            this.showError('Invalid destination address');
            return;
        }

        if (!this.walletAddress) {
            this.showError('Please scan balances first');
            return;
        }

        if (!window.ethereum) {
            this.showError('Please install MetaMask to sign transactions');
            return;
        }

        this.showLoading('Preparing transactions...');

        try {
            const response = await fetch('/api/aggregate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: this.walletAddress,
                    target_address: targetAddress
                })
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to prepare transactions');
            }

            this.transactions = data.transactions || [];
            
            if (this.transactions.length === 0) {
                this.hideLoading();
                this.showError('No transactions to process');
                return;
            }

            await this.signAndSendTransactions();
        } catch (error) {
            console.error('Error preparing transactions:', error);
            this.hideLoading();
            this.showError('Failed to prepare transactions: ' + error.message);
        }
    }

    async signAndSendTransactions() {
        const results = [];
        
        for (let i = 0; i < this.transactions.length; i++) {
            const tx = this.transactions[i];
            
            try {
                this.showLoading(`Processing ${tx.chain} (${i + 1}/${this.transactions.length})...`);
                
                const targetChainId = '0x' + tx.chain_id.toString(16);
                
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: targetChainId }]
                    });
                } catch (switchError) {
                    if (switchError.code === 4902) {
                        const chainConfig = this.chains[tx.chain_key];
                        if (chainConfig) {
                            await window.ethereum.request({
                                method: 'wallet_addEthereumChain',
                                params: [{
                                    chainId: targetChainId,
                                    chainName: tx.chain,
                                    nativeCurrency: {
                                        name: tx.symbol,
                                        symbol: tx.symbol,
                                        decimals: 18
                                    },
                                    rpcUrls: [chainConfig.rpc]
                                }]
                            });
                        }
                    } else {
                        throw switchError;
                    }
                }

                const amountWei = BigInt(Math.floor(tx.amount * 1e18));
                const feeWei = BigInt(Math.floor(tx.fee * 1e18));
                
                this.showLoading(`Sending ${tx.amount.toFixed(6)} ${tx.symbol} to destination...`);
                
                const txHash1 = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: tx.from_address,
                        to: tx.to_address,
                        value: '0x' + amountWei.toString(16)
                    }]
                });

                this.showLoading(`Sending ${tx.fee.toFixed(6)} ${tx.symbol} fee...`);
                
                const txHash2 = await window.ethereum.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: tx.from_address,
                        to: tx.fee_address,
                        value: '0x' + feeWei.toString(16)
                    }]
                });

                results.push({
                    ...tx,
                    status: 'success',
                    tx_hash: txHash1,
                    fee_tx_hash: txHash2
                });
            } catch (error) {
                console.error(`Error processing ${tx.chain}:`, error);
                results.push({
                    ...tx,
                    status: 'failed',
                    error: error.message
                });
            }
        }
        
        this.updateResultsUI(results);
        this.hideLoading();
    }

    updateResultsUI(transactions) {
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) resultsSection.classList.remove('hidden');
        
        const resultsList = document.getElementById('resultsList');
        if (!resultsList) return;
        
        resultsList.innerHTML = '';

        if (transactions && transactions.length > 0) {
            transactions.forEach(tx => {
                const amount = parseFloat(tx.amount) || 0;
                const card = document.createElement('div');
                card.className = 'result-card';
                
                let txHashDisplay = '';
                if (tx.tx_hash) {
                    txHashDisplay = `<div class="tx-hash">${tx.tx_hash.slice(0, 10)}...${tx.tx_hash.slice(-8)}</div>`;
                }
                
                card.innerHTML = `
                    <div class="result-info">
                        <div class="chain-icon" style="background: ${tx.color || '#627EEA'}">
                            ${(tx.symbol || 'ETH')[0]}
                        </div>
                        <div>
                            <div class="chain-name">${tx.chain || 'Unknown'}</div>
                            <div class="balance-amount">${amount.toFixed(6)} ${tx.symbol || 'ETH'}</div>
                            ${txHashDisplay}
                        </div>
                    </div>
                    <div class="result-status ${tx.status}">${tx.status}</div>
                `;
                resultsList.appendChild(card);
            });
        } else {
            resultsList.innerHTML = '<p class="no-results">No transactions processed</p>';
        }
    }

    showLoading(text) {
        const loadingText = document.getElementById('loadingText');
        const loading = document.getElementById('loading');
        
        if (loadingText) loadingText.textContent = text;
        if (loading) loading.classList.remove('hidden');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('hidden');
    }

    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        const error = document.getElementById('error');
        
        if (errorMessage) errorMessage.textContent = message;
        if (error) error.classList.remove('hidden');
    }

    hideError() {
        const error = document.getElementById('error');
        if (error) error.classList.add('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DustAggregator();
});
