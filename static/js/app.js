// EIP-7702 Dust Aggregator - Frontend Logic

class DustAggregatorApp {
    constructor() {
        this.apiBase = '/api';
        this.privateKey = null;
        this.walletAddress = null;
        this.chains = {};
        this.balances = {};
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadChains();
    }
    
    bindEvents() {
        // Toggle password visibility
        document.getElementById('toggleKey').addEventListener('click', () => {
            const input = document.getElementById('privateKey');
            input.type = input.type === 'password' ? 'text' : 'password';
        });
        
        // Connect button
        document.getElementById('connectBtn').addEventListener('click', () => {
            this.connect();
        });
        
        // Aggregate button
        document.getElementById('aggregateBtn').addEventListener('click', () => {
            this.aggregate();
        });
        
        // Close toast
        document.getElementById('closeToast').addEventListener('click', () => {
            this.hideToast();
        });
    }
    
    async loadChains() {
        try {
            const response = await fetch(`${this.apiBase}/chains`);
            const data = await response.json();
            this.chains = data.chains;
        } catch (error) {
            this.showToast('Failed to load chains', 'error');
        }
    }
    
    async connect() {
        const privateKey = document.getElementById('privateKey').value.trim();
        
        if (!privateKey) {
            this.showToast('Please enter your private key', 'warning');
            return;
        }
        
        this.setLoading('connectBtn', true);
        
        try {
            const response = await fetch(`${this.apiBase}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ private_key: privateKey })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.privateKey = privateKey;
                this.walletAddress = data.address;
                
                this.showWalletInfo(data.address);
                this.showChainsStatus(data.connections);
                this.loadBalances();
                
                this.showToast('Connected successfully!', 'success');
            } else {
                this.showToast(data.error || 'Connection failed', 'error');
            }
        } catch (error) {
            this.showToast('Connection error: ' + error.message, 'error');
        } finally {
            this.setLoading('connectBtn', false);
        }
    }
    
    async loadBalances() {
        if (!this.privateKey) return;
        
        try {
            const response = await fetch(`${this.apiBase}/balances`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    private_key: this.privateKey,
                    min_balance: 0.0001
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.balances = data.balances;
                this.showBalances(data.balances);
                
                if (Object.keys(data.balances).length > 0) {
                    this.showAggregationSection();
                }
            } else {
                this.showToast(data.error || 'Failed to load balances', 'error');
            }
        } catch (error) {
            this.showToast('Error loading balances: ' + error.message, 'error');
        }
    }
    
    async aggregate() {
        const targetAddress = document.getElementById('targetAddress').value.trim();
        
        if (!targetAddress) {
            this.showToast('Please enter target address', 'warning');
            return;
        }
        
        if (!this.privateKey) {
            this.showToast('Please connect wallet first', 'warning');
            return;
        }
        
        this.setLoading('aggregateBtn', true);
        
        try {
            const response = await fetch(`${this.apiBase}/aggregate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    private_key: this.privateKey,
                    target_address: targetAddress
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showResults(data.result);
                this.showToast('Aggregation completed!', 'success');
            } else {
                this.showToast(data.error || 'Aggregation failed', 'error');
            }
        } catch (error) {
            this.showToast('Aggregation error: ' + error.message, 'error');
        } finally {
            this.setLoading('aggregateBtn', false);
        }
    }
    
    showWalletInfo(address) {
        document.getElementById('walletAddress').textContent = address;
        document.getElementById('walletInfo').classList.remove('hidden');
    }
    
    showChainsStatus(connections) {
        const container = document.getElementById('chainsList');
        container.innerHTML = '';
        
        Object.entries(connections).forEach(([chain, status]) => {
            const chainConfig = this.chains[chain];
            const item = document.createElement('div');
            item.className = 'chain-item';
            item.innerHTML = `
                <div class="chain-status ${status.status}"></div>
                <span class="chain-name">${chainConfig?.name || chain}</span>
            `;
            container.appendChild(item);
        });
        
        document.getElementById('chainsStatus').classList.remove('hidden');
    }
    
    showBalances(balances) {
        const container = document.getElementById('balancesList');
        container.innerHTML = '';
        
        let total = 0;
        
        Object.entries(balances).forEach(([chain, balance]) => {
            total += balance.balance;
            
            const item = document.createElement('div');
            item.className = 'balance-item';
            item.style.borderLeftColor = balance.color;
            item.innerHTML = `
                <div class="balance-header">
                    <span class="balance-name">${balance.name}</span>
                    <span class="balance-symbol">${balance.symbol}</span>
                </div>
                <div class="balance-amount">${balance.balance.toFixed(6)}</div>
            `;
            container.appendChild(item);
        });
        
        document.getElementById('totalBalance').textContent = total.toFixed(6) + ' ETH';
        document.getElementById('balancesSection').classList.remove('hidden');
    }
    
    showAggregationSection() {
        document.getElementById('aggregationSection').classList.remove('hidden');
    }
    
    showResults(result) {
        const container = document.getElementById('resultsList');
        container.innerHTML = '';
        
        result.results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'result-item';
            
            if (item.status === 'ready') {
                div.innerHTML = `
                    <div class="result-header">
                        <span class="result-chain">${item.name}</span>
                        <span class="result-status ${item.status}">${item.status}</span>
                    </div>
                    <div class="result-details">
                        <div class="result-detail">
                            <span class="label">Original:</span>
                            <span class="value">${item.original_balance.toFixed(6)} ${item.symbol}</span>
                        </div>
                        <div class="result-detail">
                            <span class="label">Gas Cost:</span>
                            <span class="value">${item.gas_cost.toFixed(6)} ${item.symbol}</span>
                        </div>
                        <div class="result-detail">
                            <span class="label">Fee (5%):</span>
                            <span class="value">${item.fee_amount.toFixed(6)} ${item.symbol}</span>
                        </div>
                        <div class="result-detail">
                            <span class="label">To User:</span>
                            <span class="value">${item.user_amount.toFixed(6)} ${item.symbol}</span>
                        </div>
                    </div>
                `;
            } else {
                div.innerHTML = `
                    <div class="result-header">
                        <span class="result-chain">${item.chain}</span>
                        <span class="result-status ${item.status}">${item.status}</span>
                    </div>
                    <div class="result-details">
                        <div class="result-detail">
                            <span class="label">Error:</span>
                            <span class="value">${item.error}</span>
                        </div>
                    </div>
                `;
            }
            
            container.appendChild(div);
        });
        
        document.getElementById('totalToUser').textContent = result.total_aggregated.toFixed(6) + ' ETH';
        document.getElementById('totalFee').textContent = result.total_fee.toFixed(6) + ' ETH';
        document.getElementById('resultsSection').classList.remove('hidden');
    }
    
    setLoading(btnId, loading) {
        const btn = document.getElementById(btnId);
        btn.disabled = loading;
        btn.classList.toggle('loading', loading);
    }
    
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        
        toast.className = 'toast ' + type;
        toastMessage.textContent = message;
        
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }
    
    hideToast() {
        const toast = document.getElementById('toast');
        toast.classList.add('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DustAggregatorApp();
});
