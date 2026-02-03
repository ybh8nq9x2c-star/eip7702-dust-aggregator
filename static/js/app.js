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

    // Safe ethereum access - prevents redefine errors
    function getEthereum() {
        try {
            return window.ethereum;
        } catch (e) {
            console.warn('Cannot access window.ethereum:', e);
            return null;
        }
    }

    // DOM Elements
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    const walletInfo = document.getElementById('walletInfo');
    const walletAddress = document.getElementById('walletAddress');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const walletAddressInput = document.getElementById('walletAddressInput');
    const chainsGrid = document.getElementById('chainsGrid');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const scanBtn = document.getElementById('scanBtn');
    const sweepBtn = document.getElementById('sweepBtn');
    const loading = document.getElementById('loading');
    const resultsSection = document.getElementById('resultsSection');
    const txStatusSection = document.getElementById('txStatusSection');

    // Initialize
    function init() {
        console.log('Initializing ZeroDust...');
        
        // Safe ethers.js check
        if (typeof window.ethers === 'undefined') {
            console.error('Ethers.js not loaded');
            showError('Ethers.js failed to load. Please refresh the page.');
            return;
        }

        // Check ethereum safely
        const eth = getEthereum();
        if (!eth) {
            console.warn('No wallet provider detected');
        } else {
            console.log('Wallet provider detected');
        }

        loadChains();
        setupEventListeners();
        checkExistingConnection();
        
        console.log('ZeroDust initialized successfully');
    }

    // Load chains configuration
    async function loadChains() {
        try {
            const response = await fetch('/api/chains');
            if (!response.ok) throw new Error('Failed to fetch chains');
            chains = await response.json();
            renderChainsGrid();
            
            // Select all chains by default
            Object.keys(chains).forEach(key => selectedChains.add(key));
            updateChainCheckboxes();
            
            console.log('Loaded', Object.keys(chains).length, 'chains');
        } catch (error) {
            console.error('Failed to load chains:', error);
            showError('Failed to load chains. Please refresh.');
        }
    }

    // Render chains grid
    function renderChainsGrid() {
        chainsGrid.innerHTML = '';
        
        Object.entries(chains).forEach(([key, chain]) => {
            const chainEl = document.createElement('div');
            chainEl.className = 'chain-card';
            chainEl.innerHTML = `
                <input type="checkbox" id="chain-${key}" value="${key}" checked>
                <label for="chain-${key}">
                    <span class="chain-icon" style="background: ${chain.color}"></span>
                    <span class="chain-name">${chain.name}</span>
                    <span class="chain-symbol">${chain.symbol}</span>
                </label>
            `;
            chainsGrid.appendChild(chainEl);
            
            // Attach event listener directly to the checkbox
            const checkbox = chainEl.querySelector('input');
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        selectedChains.add(key);
                    } else {
                        selectedChains.delete(key);
                    }
                    console.log('Chain', key, 'selected:', e.target.checked);
                });
            }
        });
    }

    // Update checkboxes
    function updateChainCheckboxes() {
        selectedChains.forEach(key => {
            const checkbox = document.getElementById(`chain-${key}`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // Setup event listeners
    function setupEventListeners() {
        console.log('Setting up event listeners...');
        
        if (connectWalletBtn) {
            connectWalletBtn.addEventListener('click', connectWallet);
        }
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', disconnectWallet);
        }
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                Object.keys(chains).forEach(key => selectedChains.add(key));
                document.querySelectorAll('#chainsGrid input').forEach(cb => cb.checked = true);
                console.log('All chains selected');
            });
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                selectedChains.clear();
                document.querySelectorAll('#chainsGrid input').forEach(cb => cb.checked = false);
                console.log('All chains deselected');
            });
        }
        
        if (scanBtn) {
            scanBtn.addEventListener('click', scanBalances);
        }
        
        if (sweepBtn) {
            sweepBtn.addEventListener('click', executeSweep);
        }
        
        // Manual address input
        if (walletAddressInput) {
            walletAddressInput.addEventListener('input', (e) => {
                if (isValidAddress(e.target.value)) {
                    currentAccount = e.target.value;
                    updateWalletUI();
                }
            });
        }
        
        // Destination chain change
        const destChainSelect = document.getElementById('destinationChain');
        if (destChainSelect) {
            destChainSelect.addEventListener('change', () => {
                if (scannedBalances.length > 0) {
                    estimateCosts();
                }
            });
        }
        
        console.log('Event listeners set up');
    }

    // Check existing connection
    async function checkExistingConnection() {
        const eth = getEthereum();
        if (eth && eth.selectedAddress) {
            currentAccount = eth.selectedAddress;
            walletAddressInput.value = currentAccount;
            updateWalletUI();
        }
    }

    // Connect wallet
    async function connectWallet() {
        try {
            const eth = getEthereum();
            if (!eth) {
                showError('MetaMask not installed. Please install MetaMask to connect.');
                return;
            }

            const accounts = await eth.request({
                method: 'eth_requestAccounts'
            });

            if (accounts && accounts.length > 0) {
                currentAccount = accounts[0];
                walletAddressInput.value = currentAccount;
                updateWalletUI();
            }
        } catch (error) {
            console.error('Connection error:', error);
            showError('Failed to connect wallet: ' + error.message);
        }
    }

    // Disconnect wallet
    function disconnectWallet() {
        currentAccount = null;
        walletAddressInput.value = '';
        updateWalletUI();
        resultsSection.classList.add('hidden');
    }

    // Update wallet UI
    function updateWalletUI() {
        if (currentAccount) {
            if (connectWalletBtn) connectWalletBtn.classList.add('hidden');
            if (walletInfo) walletInfo.classList.remove('hidden');
            if (walletAddress) walletAddress.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
        } else {
            if (connectWalletBtn) connectWalletBtn.classList.remove('hidden');
            if (walletInfo) walletInfo.classList.add('hidden');
        }
    }

    // Scan balances
    async function scanBalances() {
        const address = walletAddressInput.value.trim();
        
        if (!isValidAddress(address)) {
            showError('Please enter a valid wallet address');
            return;
        }

        if (selectedChains.size === 0) {
            showError('Please select at least one chain');
            return;
        }

        showLoading('Scanning balances across chains...');
        resultsSection.classList.add('hidden');

        try {
            const response = await fetch('/api/balances', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: address,
                    chains: Array.from(selectedChains)
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            scannedBalances = (data.balances || []).filter(b => b.balance > 0 && b.balance_usd > 0.01);
            
            if (scannedBalances.length === 0) {
                hideLoading();
                showInfo('No balances found across selected chains. Try selecting more chains.');
                return;
            }

            displayResults(data);
            hideLoading();
            
        } catch (error) {
            console.error('Scan error:', error);
            hideLoading();
            showError('Failed to scan balances: ' + error.message);
        }
    }

    // Display results
    function displayResults(data) {
        resultsSection.classList.remove('hidden');
        txStatusSection.classList.add('hidden');
        
        // Update totals
        const totalUsdEl = document.getElementById('totalUSD');
        if (totalUsdEl) totalUsdEl.textContent = `$${(data.total_usd || 0).toFixed(2)}`;
        
        const chainCountEl = document.getElementById('chainCount');
        if (chainCountEl) chainCountEl.textContent = `${scannedBalances.length} chain(s) with balance`;
        
        // Display balances list
        const balancesList = document.querySelector('.balances-list');
        if (balancesList) {
            balancesList.innerHTML = '';
            
            scannedBalances.forEach(bal => {
                const balanceEl = document.createElement('div');
                balanceEl.className = 'balance-card';
                balanceEl.innerHTML = `
                    <div class="balance-header">
                        <div class="chain-info">
                            <span class="chain-icon" style="background: ${bal.color}"></span>
                            <span class="chain-name">${bal.name}</span>
                        </div>
                        <span class="balance-amount">${(bal.balance || 0).toFixed(4)} ${bal.symbol}</span>
                    </div>
                    <div class="balance-footer">
                        <span class="balance-usd">≈ $${(bal.balance_usd || 0).toFixed(2)}</span>
                        <span class="checkbox-wrapper">
                            <input type="checkbox" class="balance-checkbox" data-chain="${bal.key}" checked>
                        </span>
                    </div>
                `;
                balancesList.appendChild(balanceEl);
            });
        }

        // Estimate costs
        estimateCosts();
    }

    // Estimate costs
    async function estimateCosts() {
        try {
            const destChainSelect = document.getElementById('destinationChain');
            const destinationChain = destChainSelect ? destChainSelect.value : 'ethereum';
            
            const selectedBalances = scannedBalances.filter(b => {
                const checkbox = document.querySelector(`.balance-checkbox[data-chain="${b.key}"]`);
                return checkbox && checkbox.checked;
            });

            if (selectedBalances.length === 0) {
                updateFeeUI(0, 0, 0, 0);
                return;
            }

            const response = await fetch('/api/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_address: currentAccount,
                    to_address: currentAccount,
                    destination_chain: destinationChain,
                    balances: selectedBalances
                })
            });

            const data = await response.json();
            
            if (data.error) {
                console.error('Estimate error:', data.error);
                return;
            }

            currentEstimates = data.estimates || [];
            const summary = data.summary || {};

            updateFeeUI(
                summary.total_gas_cost_usd || 0,
                summary.total_service_fee_usd || 0,
                summary.total_fees_usd || 0,
                summary.total_transfer_usd || 0
            );

        } catch (error) {
            console.error('Estimate error:', error);
        }
    }

    // Update fee UI
    function updateFeeUI(gasCost, serviceFee, totalFees, netReceive) {
        const gasCostEl = document.getElementById('totalGasCost');
        const serviceFeeEl = document.getElementById('totalServiceFee');
        const totalFeesEl = document.getElementById('totalFees');
        const netReceiveEl = document.getElementById('netReceive');

        if (gasCostEl) gasCostEl.textContent = `$${gasCost.toFixed(2)}`;
        if (serviceFeeEl) serviceFeeEl.textContent = `$${serviceFee.toFixed(2)}`;
        if (totalFeesEl) totalFeesEl.textContent = `$${totalFees.toFixed(2)}`;
        if (netReceiveEl) netReceiveEl.textContent = `$${netReceive.toFixed(2)}`;
    }

    // Execute sponsored sweep
    async function executeSweep() {
        if (currentEstimates.length === 0) {
            showError('No balances selected. Please scan first.');
            return;
        }

        if (!currentAccount) {
            showError('Please connect wallet first');
            return;
        }

        const destChainSelect = document.getElementById('destinationChain');
        const destinationChain = destChainSelect ? destChainSelect.value : 'ethereum';

        showLoading('Preparing EIP-7702 sponsored sweep...');

        try {
            const response = await fetch('/api/sweep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_address: currentAccount,
                    to_address: currentAccount,
                    estimates: currentEstimates,
                    signature: '0x'
                })
            });

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            hideLoading();
            displayTransactionStatus(data.transactions);
            showSuccess('EIP-7702 sponsored sweep initiated! Sponsor is processing transactions...');

        } catch (error) {
            console.error('Sweep error:', error);
            hideLoading();
            showError('Failed to execute sweep: ' + error.message);
        }
    }

    // Display transaction status
    function displayTransactionStatus(transactions) {
        txStatusSection.classList.remove('hidden');
        const txList = document.getElementById('txList');
        if (txList) {
            txList.innerHTML = '';

            (transactions || []).forEach((tx, index) => {
                const txEl = document.createElement('div');
                txEl.className = 'tx-card';
                txEl.innerHTML = `
                    <div class="tx-header">
                        <span class="tx-chain">${tx.chain_name}</span>
                        <span class="tx-status pending">Pending</span>
                    </div>
                    <div class="tx-body">
                        <div class="tx-row">
                            <span>Amount:</span>
                            <span>${((parseFloat(tx.value) || 0) / 1e18).toFixed(6)} ETH</span>
                        </div>
                        <div class="tx-row">
                            <span>Type:</span>
                            <span>EIP-7702 Sponsored</span>
                        </div>
                        <div class="tx-row">
                            <span>Sponsor:</span>
                            <span>${(tx.from || '').slice(0, 8)}...</span>
                        </div>
                    </div>
                `;
                txList.appendChild(txEl);
            });
        }
    }

    // Utility functions
    function isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    function showLoading(message) {
        if (loading) {
            const span = loading.querySelector('span');
            if (span) span.textContent = message;
            loading.classList.remove('hidden');
        }
    }

    function hideLoading() {
        if (loading) loading.classList.add('hidden');
    }

    function showError(message) {
        console.error(message);
        setTimeout(() => alert('Error: ' + message), 100);
    }

    function showSuccess(message) {
        console.log(message);
        setTimeout(() => alert('Success: ' + message), 100);
    }

    function showInfo(message) {
        console.info(message);
        setTimeout(() => alert('Info: ' + message), 100);
    }

    // Handle balance checkbox changes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('balance-checkbox')) {
            estimateCosts();
        }
    });

    // Handle account changes safely
    const eth = getEthereum();
    if (eth && typeof eth.on === 'function') {
        eth.on('accountsChanged', (accounts) => {
            if (accounts && accounts.length > 0) {
                currentAccount = accounts[0];
                if (walletAddressInput) walletAddressInput.value = currentAccount;
                updateWalletUI();
            } else {
                disconnectWallet();
            }
        });
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
