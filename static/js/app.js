// Dust.zip - ZeroDust EIP-7702 Dust Aggregator
// Sponsored transactions - sponsor pays gas

(function() {
    'use strict';

    // State
    let currentAccount = null;
    let chains = {};
    let selectedChains = new Set();
    let scannedBalances = [];
    let currentEstimates = [];
    let isInitialized = false;

    // Safe ethereum access
    function getEthereum() {
        try {
            return window.ethereum;
        } catch (e) {
            console.warn('Cannot access window.ethereum:', e);
            return null;
        }
    }

    // DOM Elements - cached safely
    function getElements() {
        return {
            connectWalletBtn: document.getElementById('connectWalletBtn'),
            walletInfo: document.getElementById('walletInfo'),
            walletAddress: document.getElementById('walletAddress'),
            disconnectBtn: document.getElementById('disconnectBtn'),
            walletAddressInput: document.getElementById('walletAddressInput'),
            chainsGrid: document.getElementById('chainsGrid'),
            selectAllBtn: document.getElementById('selectAllBtn'),
            deselectAllBtn: document.getElementById('deselectAllBtn'),
            scanBtn: document.getElementById('scanBtn'),
            sweepBtn: document.getElementById('sweepBtn'),
            loading: document.getElementById('loading'),
            resultsSection: document.getElementById('resultsSection'),
            txStatusSection: document.getElementById('txStatusSection')
        };
    }

    // Initialize
    function init() {
        console.log('🚀 Initializing ZeroDust...');
        isInitialized = true;
        
        // Safe ethers.js check
        if (typeof window.ethers === 'undefined') {
            console.error('❌ Ethers.js not loaded');
            showError('Ethers.js failed to load. Please refresh the page.');
            return;
        }

        console.log('✅ Ethers.js loaded');

        // Check ethereum safely
        const eth = getEthereum();
        if (eth) {
            console.log('✅ Wallet provider detected');
        } else {
            console.log('⚠️ No wallet provider detected');
        }

        loadChains();
        setupEventListeners();
        checkExistingConnection();
        
        console.log('✅ ZeroDust initialized successfully');
    }

    // Load chains configuration
    async function loadChains() {
        try {
            console.log('📡 Loading chains configuration...');
            const response = await fetch('/api/chains');
            if (!response.ok) throw new Error('Failed to fetch chains');
            chains = await response.json();
            console.log('✅ Chains loaded:', Object.keys(chains).length);
            
            renderChainsGrid();
            
            // Select all chains by default
            console.log('📌 Selecting all chains by default...');
            Object.keys(chains).forEach(key => selectedChains.add(key));
            console.log('✅ Selected chains:', Array.from(selectedChains));
            
            // Wait for DOM to update before syncing checkboxes
            setTimeout(() => {
                updateChainSelection();
                console.log('✅ Chain selection updated');
            }, 100);
            
        } catch (error) {
            console.error('❌ Failed to load chains:', error);
            showError('Failed to load chains. Please refresh.');
        }
    }

    // Render chains grid - COMPLETELY REWRITTEN
    function renderChainsGrid() {
        const el = getElements();
        if (!el.chainsGrid) {
            console.error('❌ chainsGrid element not found');
            return;
        }

        el.chainsGrid.innerHTML = '';
        console.log('🎨 Rendering', Object.keys(chains).length, 'chains...');
        
        Object.entries(chains).forEach(([key, chain]) => {
            const isSelected = selectedChains.has(key);
            const chainEl = document.createElement('div');
            chainEl.className = `chain-card ${isSelected ? 'selected' : ''}`;
            chainEl.dataset.chainKey = key;
            
            chainEl.innerHTML = `
                <input type="checkbox" id="chain-${key}" value="${key}" ${isSelected ? 'checked' : ''}>
                <label for="chain-${key}">
                    <span class="chain-icon" style="background: ${chain.color}"></span>
                    <span class="chain-name">${chain.name}</span>
                    <span class="chain-symbol">${chain.symbol}</span>
                </label>
            `;
            
            // Add click handler to the ENTIRE card
            chainEl.addEventListener('click', (e) => {
                console.log('🔘 Chain card clicked:', key);
                
                // If clicking directly on checkbox, let it handle itself
                if (e.target.type === 'checkbox') {
                    handleChainChange(key, e.target.checked);
                    return;
                }
                
                // Otherwise, toggle the checkbox
                const checkbox = chainEl.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    handleChainChange(key, checkbox.checked);
                }
            });
            
            // Also handle change event on checkbox
            const checkbox = chainEl.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    console.log('🔘 Checkbox changed:', key, 'checked:', e.target.checked);
                    handleChainChange(key, e.target.checked);
                });
            }
            
            el.chainsGrid.appendChild(chainEl);
        });
        
        console.log('✅ Chains rendered with click handlers');
    }

    // Handle chain selection change
    function handleChainChange(key, isChecked) {
        console.log('🔄 Chain selection changed:', key, isChecked);
        
        if (isChecked) {
            selectedChains.add(key);
            console.log('✅ Chain added:', key, 'Total selected:', selectedChains.size);
        } else {
            selectedChains.delete(key);
            console.log('❌ Chain removed:', key, 'Total selected:', selectedChains.size);
        }
        
        console.log('📊 Current selection:', Array.from(selectedChains));
        
        // Update visual state
        updateChainSelection();
    }

    // Update chain selection visual state
    function updateChainSelection() {
        console.log('🔄 Updating chain selection visual state...');
        const el = getElements();
        if (!el.chainsGrid) return;
        
        const chainCards = el.chainsGrid.querySelectorAll('.chain-card');
        chainCards.forEach(card => {
            const key = card.dataset.chainKey;
            const checkbox = card.querySelector('input[type="checkbox"]');
            
            if (key && selectedChains.has(key)) {
                card.classList.add('selected');
                if (checkbox) checkbox.checked = true;
                console.log(`  ✓ Chain ${key}: SELECTED`);
            } else {
                card.classList.remove('selected');
                if (checkbox) checkbox.checked = false;
                console.log(`  ✗ Chain ${key}: NOT SELECTED`);
            }
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        console.log('🎯 Setting up event listeners...');
        const el = getElements();
        
        if (el.connectWalletBtn) {
            el.connectWalletBtn.addEventListener('click', connectWallet);
            console.log('✅ Connect wallet listener attached');
        }
        
        if (el.disconnectBtn) {
            el.disconnectBtn.addEventListener('click', disconnectWallet);
            console.log('✅ Disconnect wallet listener attached');
        }
        
        if (el.selectAllBtn) {
            el.selectAllBtn.addEventListener('click', () => {
                console.log('📌 Select All clicked');
                Object.keys(chains).forEach(key => selectedChains.add(key));
                updateChainSelection();
                console.log('✅ All chains selected:', selectedChains.size);
            });
            console.log('✅ Select All listener attached');
        }
        
        if (el.deselectAllBtn) {
            el.deselectAllBtn.addEventListener('click', () => {
                console.log('📌 Deselect All clicked');
                selectedChains.clear();
                updateChainSelection();
                console.log('✅ All chains deselected');
            });
            console.log('✅ Deselect All listener attached');
        }
        
        if (el.scanBtn) {
            el.scanBtn.addEventListener('click', scanBalances);
            console.log('✅ Scan balances listener attached');
        }
        
        if (el.sweepBtn) {
            el.sweepBtn.addEventListener('click', executeSweep);
            console.log('✅ Sweep listener attached');
        }
        
        // Handle manual address input
        if (el.walletAddressInput) {
            el.walletAddressInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    scanBalances();
                }
            });
            console.log('✅ Address input listener attached');
        }
        
        console.log('✅ All event listeners attached');
    }

    // Connect wallet
    async function connectWallet() {
        console.log('🔗 Connecting wallet...');
        
        const eth = getEthereum();
        if (!eth) {
            showError('No wallet detected. Please install MetaMask.');
            return;
        }

        try {
            const provider = new ethers.BrowserProvider(eth);
            const accounts = await provider.send('eth_requestAccounts', []);
            
            if (accounts.length === 0) {
                showError('No accounts found');
                return;
            }

            currentAccount = accounts[0];
            console.log('✅ Wallet connected:', currentAccount);
            
            const el = getElements();
            if (el.connectWalletBtn) {
                el.connectWalletBtn.classList.add('connected');
                el.connectWalletBtn.textContent = 'Wallet Connected';
            }
            if (el.walletInfo) {
                el.walletInfo.classList.remove('hidden');
            }
            if (el.walletAddress) {
                el.walletAddress.textContent = currentAccount.slice(0, 6) + '...' + currentAccount.slice(-4);
            }
            if (el.walletAddressInput) {
                el.walletAddressInput.value = currentAccount;
            }
            
            showSuccess('Wallet connected successfully!');
        } catch (error) {
            console.error('❌ Failed to connect wallet:', error);
            showError('Failed to connect wallet: ' + error.message);
        }
    }

    // Disconnect wallet
    function disconnectWallet() {
        console.log('🔌 Disconnecting wallet...');
        currentAccount = null;
        
        const el = getElements();
        if (el.connectWalletBtn) {
            el.connectWalletBtn.classList.remove('connected');
            el.connectWalletBtn.textContent = 'Connect Wallet';
        }
        if (el.walletInfo) {
            el.walletInfo.classList.add('hidden');
        }
        if (el.walletAddressInput) {
            el.walletAddressInput.value = '';
        }
        
        console.log('✅ Wallet disconnected');
        showSuccess('Wallet disconnected');
    }

    // Check existing connection
    async function checkExistingConnection() {
        const eth = getEthereum();
        if (!eth) return;

        try {
            const provider = new ethers.BrowserProvider(eth);
            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                currentAccount = accounts[0].address;
                console.log('✅ Existing connection:', currentAccount);
                
                const el = getElements();
                if (el.connectWalletBtn) {
                    el.connectWalletBtn.classList.add('connected');
                    el.connectWalletBtn.textContent = 'Wallet Connected';
                }
                if (el.walletInfo) {
                    el.walletInfo.classList.remove('hidden');
                }
                if (el.walletAddress) {
                    el.walletAddress.textContent = currentAccount.slice(0, 6) + '...' + currentAccount.slice(-4);
                }
                if (el.walletAddressInput) {
                    el.walletAddressInput.value = currentAccount;
                }
            }
        } catch (error) {
            console.warn('Could not check existing connection:', error);
        }
    }

    // Scan balances
    async function scanBalances() {
        console.log('🔍 Scanning balances...');
        
        // Check if any chains are selected
        if (selectedChains.size === 0) {
            showError('Please select at least one chain to scan');
            return;
        }
        
        // Get address
        let address;
        const el = getElements();
        if (el.walletAddressInput && el.walletAddressInput.value) {
            address = el.walletAddressInput.value.trim();
        }
        
        if (!address) {
            showError('Please enter a wallet address or connect your wallet');
            return;
        }
        
        console.log('📋 Address:', address);
        console.log('📋 Selected chains:', Array.from(selectedChains));
        
        // Show loading
        if (el.loading) el.loading.classList.remove('hidden');
        if (el.resultsSection) el.resultsSection.classList.add('hidden');
        
        try {
            const response = await fetch('/api/balances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address,
                    chains: Array.from(selectedChains)
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to scan balances');
            }
            
            const data = await response.json();
            console.log('✅ Balances received:', data.balances.length, 'chains with dust');
            
            scannedBalances = data.balances;
            
            // Hide loading
            if (el.loading) el.loading.classList.add('hidden');
            
            // Display results
            if (scannedBalances.length === 0) {
                showInfo('No dust found on selected chains');
                if (el.resultsSection) el.resultsSection.classList.add('hidden');
            } else {
                displayResults(data);
                showSuccess(`Found ${scannedBalances.length} chains with dust`);
            }
            
        } catch (error) {
            console.error('❌ Failed to scan balances:', error);
            if (el.loading) el.loading.classList.add('hidden');
            showError('Failed to scan balances: ' + error.message);
        }
    }

    // Display results
    function displayResults(data) {
        const el = getElements();
        if (!el.resultsSection) return;
        
        // Build results HTML
        let html = `
            <div class="totals">
                <div class="total-row">
                    <span>Total Balance</span>
                    <div class="total-values">
                        <span>${data.total_balance} ${data.total_symbol}</span>
                        <span class="usd">≈ $${data.total_usd}</span>
                    </div>
                </div>
                <div class="total-row fee">
                    <span>Fee (5%)</span>
                    <div class="total-values">
                        <span>-${data.fee} ${data.total_symbol}</span>
                        <span class="usd">≈ -$${data.fee_usd}</span>
                    </div>
                </div>
                <div class="total-row net">
                    <span>You'll Receive</span>
                    <div class="total-values">
                        <span>${data.net_balance} ${data.total_symbol}</span>
                        <span class="usd">≈ $${data.net_usd}</span>
                    </div>
                </div>
            </div>
            
            <div class="destination-section">
                <h3>Destination Chain</h3>
                <div class="dest-row">
                    <label>Select where to send your dust:</label>
                    <select class="chain-select" id="destChain">
                        ${Object.entries(chains).map(([key, chain]) => 
                            `<option value="${key}">${chain.name} (${chain.symbol})</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            
            <h3>Balances Found</h3>
            <div class="balances-list">
                ${scannedBalances.map(b => `
                    <div class="balance-card" data-chain="${b.chain}">
                        <div class="balance-header">
                            <input type="checkbox" class="balance-checkbox" checked>
                            <div class="chain-info">
                                <span class="chain-icon" style="background: ${b.color}"></span>
                                <span>${b.chain}</span>
                            </div>
                        </div>
                        <div class="balance-footer">
                            <span class="balance-amount">${b.balance} ${b.symbol}</span>
                            <span class="balance-usd">≈ $${b.balance_usd}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        el.resultsSection.innerHTML = html;
        el.resultsSection.classList.remove('hidden');
        
        console.log('✅ Results displayed');
    }

    // Execute sweep
    async function executeSweep() {
        console.log('🚀 Executing sweep...');
        
        if (scannedBalances.length === 0) {
            showError('No balances selected. Please scan first.');
            return;
        }
        
        const el = getElements();
        const destChainSelect = document.getElementById('destChain');
        const destChain = destChainSelect ? destChainSelect.value : null;
        
        if (!destChain) {
            showError('Please select a destination chain');
            return;
        }
        
        // Get selected balances
        const selectedBalances = [];
        document.querySelectorAll('.balance-checkbox:checked').forEach(cb => {
            const card = cb.closest('.balance-card');
            if (card) {
                const chainKey = card.dataset.chain;
                const balance = scannedBalances.find(b => b.chain === chainKey);
                if (balance) selectedBalances.push(balance);
            }
        });
        
        if (selectedBalances.length === 0) {
            showError('No balances selected');
            return;
        }
        
        console.log('📋 Destination chain:', destChain);
        console.log('📋 Selected balances:', selectedBalances.length);
        
        // Show loading
        if (el.loading) el.loading.classList.remove('hidden');
        
        try {
            const response = await fetch('/api/sweep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    balances: selectedBalances,
                    dest_chain: destChain
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to execute sweep');
            }
            
            const result = await response.json();
            console.log('✅ Sweep executed:', result.transactions);
            
            if (el.loading) el.loading.classList.add('hidden');
            
            displayTransactions(result.transactions);
            showSuccess('Sweep completed! Check transaction hashes for details.');
            
        } catch (error) {
            console.error('❌ Failed to execute sweep:', error);
            if (el.loading) el.loading.classList.add('hidden');
            showError('Failed to execute sweep: ' + error.message);
        }
    }

    // Display transactions
    function displayTransactions(transactions) {
        const el = getElements();
        if (!el.txStatusSection) return;
        
        let html = '<h3>Transactions</h3><div class="tx-list">';
        
        transactions.forEach(tx => {
            html += `
                <div class="tx-card">
                    <div class="tx-header">
                        <span class="tx-chain">${tx.chain}</span>
                        <span class="tx-status ${tx.status}">${tx.status}</span>
                    </div>
                    <div class="tx-body">
                        <div class="tx-row">
                            <span>Amount</span>
                            <span>${tx.amount} ${tx.symbol}</span>
                        </div>
                        <div class="tx-row">
                            <span>Fee</span>
                            <span>${tx.fee} ${tx.symbol}</span>
                        </div>
                        <div class="tx-row">
                            <span>Transaction</span>
                            <a href="${tx.explorer}" target="_blank">${tx.tx_hash}</a>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        el.txStatusSection.innerHTML = html;
        el.txStatusSection.classList.remove('hidden');
    }

    // Helper functions
    function showSuccess(message) {
        showStatus(message, 'success');
    }

    function showError(message) {
        showStatus(message, 'error');
        console.error('❌', message);
    }

    function showInfo(message) {
        showStatus(message, 'info');
    }

    function showStatus(message, type) {
        const existing = document.querySelector('.status');
        if (existing) existing.remove();
        
        const status = document.createElement('div');
        status.className = `status ${type}`;
        status.textContent = message;
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(status, container.firstChild);
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                if (status && status.parentNode) {
                    status.remove();
                }
            }, 5000);
        }
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
