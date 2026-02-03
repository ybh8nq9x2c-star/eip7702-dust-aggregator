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
        if (!window.ethers) {
            console.error('Ethers.js not loaded');
            showError('Ethers.js failed to load. Please refresh the page.');
            return;
        }

        loadChains();
        setupEventListeners();
        checkExistingConnection();
    }

    // Load chains configuration
    async function loadChains() {
        try {
            const response = await fetch('/api/chains');
            chains = await response.json();
            renderChainsGrid();
            
            // Select all chains by default
            Object.keys(chains).forEach(key => selectedChains.add(key));
            updateChainCheckboxes();
        } catch (error) {
            console.error('Failed to load chains:', error);
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
            
            chainEl.querySelector('input').addEventListener('change', (e) => {
                if (e.target.checked) {
                    selectedChains.add(key);
                } else {
                    selectedChains.delete(key);
                }
            });
            
            chainsGrid.appendChild(chainEl);
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
        connectWalletBtn.addEventListener('click', connectWallet);
        disconnectBtn.addEventListener('click', disconnectWallet);
        selectAllBtn.addEventListener('click', () => {
            Object.keys(chains).forEach(key => selectedChains.add(key));
            updateChainCheckboxes();
        });
        deselectAllBtn.addEventListener('click', () => {
            selectedChains.clear();
            document.querySelectorAll('#chainsGrid input').forEach(cb => cb.checked = false);
        });
        scanBtn.addEventListener('click', scanBalances);
        sweepBtn.addEventListener('click', executeSweep);
        
        // Manual address input
        walletAddressInput.addEventListener('input', (e) => {
            if (isValidAddress(e.target.value)) {
                currentAccount = e.target.value;
                updateWalletUI();
            }
        });
    }

    // Check existing connection
    async function checkExistingConnection() {
        if (window.ethereum && window.ethereum.selectedAddress) {
            currentAccount = window.ethereum.selectedAddress;
            walletAddressInput.value = currentAccount;
            updateWalletUI();
        }
    }

    // Connect wallet
    async function connectWallet() {
        try {
            if (!window.ethereum) {
                showError('MetaMask not installed. Please install MetaMask to connect.');
                return;
            }

            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length > 0) {
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
            connectWalletBtn.classList.add('hidden');
            walletInfo.classList.remove('hidden');
            walletAddress.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
        } else {
            connectWalletBtn.classList.remove('hidden');
            walletInfo.classList.add('hidden');
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

            scannedBalances = data.balances.filter(b => b.balance > 0 && b.balance_usd > 0.01);
            
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
        document.getElementById('totalUSD').textContent = `$${data.total_usd.toFixed(2)}`;
        document.getElementById('chainCount').textContent = `${scannedBalances.length} chain(s) with balance`;
        
        // Display balances list
        const balancesList = document.querySelector('.balances-list');
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
                    <span class="balance-amount">${bal.balance.toFixed(4)} ${bal.symbol}</span>
                </div>
                <div class="balance-footer">
                    <span class="balance-usd">≈ $${bal.balance_usd.toFixed(2)}</span>
                    <span class="checkbox-wrapper">
                        <input type="checkbox" class="balance-checkbox" data-chain="${bal.key}" checked>
                    </span>
                </div>
            `;
            balancesList.appendChild(balanceEl);
        });

        // Estimate costs
        estimateCosts();
    }

    // Estimate costs
    async function estimateCosts() {
        try {
            const destinationChain = document.getElementById('destinationChain').value;
            const selectedBalances = scannedBalances.filter(b => {
                const checkbox = document.querySelector(`.balance-checkbox[data-chain="${b.key}"]`);
                return checkbox && checkbox.checked;
            });

            if (selectedBalances.length === 0) {
                document.getElementById('totalGasCost').textContent = '$0.00';
                document.getElementById('totalServiceFee').textContent = '$0.00';
                document.getElementById('totalFees').textContent = '$0.00';
                document.getElementById('netReceive').textContent = '$0.00';
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

            currentEstimates = data.estimates;
            const summary = data.summary;

            // Update UI
            document.getElementById('totalGasCost').textContent = `$${summary.total_gas_cost_usd.toFixed(2)}`;
            document.getElementById('totalServiceFee').textContent = `$${summary.total_service_fee_usd.toFixed(2)}`;
            document.getElementById('totalFees').textContent = `$${summary.total_fees_usd.toFixed(2)}`;
            document.getElementById('netReceive').textContent = `$${summary.total_transfer_usd.toFixed(2)}`;

        } catch (error) {
            console.error('Estimate error:', error);
        }
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

        const destinationChain = document.getElementById('destinationChain').value;

        // Get the chain ID for destination
        const destChainConfig = chains[destinationChain];
        if (!destChainConfig) {
            showError('Invalid destination chain');
            return;
        }

        showLoading('Preparing EIP-7702 sponsored sweep...');

        try {
            // In a real EIP-7702 implementation, you would:
            // 1. Sign a delegation message allowing the sponsor to act on your behalf
            // 2. Send the signature to the backend
            // 3. The sponsor executes the transactions paying for gas
            
            // For this simulation, we'll just show the flow
            const response = await fetch('/api/sweep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from_address: currentAccount,
                    to_address: currentAccount,
                    estimates: currentEstimates,
                    signature: '0x'  // Placeholder for EIP-7702 signature
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
        txList.innerHTML = '';

        transactions.forEach((tx, index) => {
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
                        <span>${parseFloat(tx.value) / 1e18.toFixed(6)} ETH</span>
                    </div>
                    <div class="tx-row">
                        <span>Type:</span>
                        <span>EIP-7702 Sponsored</span>
                    </div>
                    <div class="tx-row">
                        <span>Sponsor:</span>
                        <span>${tx.from.slice(0, 8)}...</span>
                    </div>
                </div>
            `;
            txList.appendChild(txEl);
        });
    }

    // Utility functions
    function isValidAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    function showLoading(message) {
        loading.querySelector('span').textContent = message;
        loading.classList.remove('hidden');
    }

    function hideLoading() {
        loading.classList.add('hidden');
    }

    function showError(message) {
        alert('Error: ' + message);
    }

    function showSuccess(message) {
        alert('Success: ' + message);
    }

    function showInfo(message) {
        alert('Info: ' + message);
    }

    // Handle destination chain change
    document.getElementById('destinationChain').addEventListener('change', () => {
        if (scannedBalances.length > 0) {
            estimateCosts();
        }
    });

    // Handle balance checkbox changes
    document.addEventListener('change', (e) => {
        if (e.target.classList.contains('balance-checkbox')) {
            estimateCosts();
        }
    });

    // Handle account changes
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
                currentAccount = accounts[0];
                walletAddressInput.value = currentAccount;
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
