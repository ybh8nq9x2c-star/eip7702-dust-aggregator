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
                updateChainCheckboxes();
                console.log('✅ Checkboxes synced with selected chains');
            }, 100);
            
        } catch (error) {
            console.error('❌ Failed to load chains:', error);
            showError('Failed to load chains. Please refresh.');
        }
    }

    // Render chains grid
    function renderChainsGrid() {
        const el = getElements();
        if (!el.chainsGrid) {
            console.error('❌ chainsGrid element not found');
            return;
        }

        el.chainsGrid.innerHTML = '';
        console.log('🎨 Rendering', Object.keys(chains).length, 'chains...');
        
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
            el.chainsGrid.appendChild(chainEl);
            
            // Attach event listener immediately
            const checkbox = chainEl.querySelector('input');
            if (checkbox) {
                // Use both change and click for better compatibility
                checkbox.addEventListener('change', (e) => handleChainChange(key, e.target.checked));
                checkbox.addEventListener('click', (e) => {
                    setTimeout(() => {
                        console.log('🔘 Chain', key, 'clicked, checked:', e.target.checked);
                    }, 0);
                });
            }
        });
        
        console.log('✅ Chains rendered');
    }

    // Handle chain selection change
    function handleChainChange(key, isChecked) {
        console.log('🔄 Chain selection changed:', key, isChecked);
        
        // Find chain card element
        const chainCard = document.querySelector(`#chain-${key}`).closest('.chain-card');
        
        if (isChecked) {
            selectedChains.add(key);
            if (chainCard) {
                chainCard.classList.add('selected');
                console.log('✅ Chain added:', key, 'Total selected:', selectedChains.size);
            }
        } else {
            selectedChains.delete(key);
            if (chainCard) {
                chainCard.classList.remove('selected');
                console.log('❌ Chain removed:', key, 'Total selected:', selectedChains.size);
            }
        }
    }

    // Update checkboxes from selectedChains
    function updateChainCheckboxes() {
        console.log('🔄 Updating checkboxes from selectedChains...');
        const el = getElements();
        if (!el.chainsGrid) return;
        
        const checkboxes = el.chainsGrid.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const key = cb.value;
            cb.checked = selectedChains.has(key);
            console.log(`  Checkbox ${key}: ${cb.checked}`);
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
                updateChainCheckboxes();
                console.log('✅ All chains selected:', selectedChains.size);
            });
            console.log('✅ Select All listener attached');
        }
        
        if (el.deselectAllBtn) {
            el.deselectAllBtn.addEventListener('click', () => {
                console.log('📌 Deselect All clicked');
                selectedChains.clear();
                updateChainCheckboxes();
                console.log('✅ All chains deselected');
            });
            console.log('✅ Deselect All listener attached');
        }
        
        if (el.scanBtn) {
            el.scanBtn.addEventListener('click', () => {
                console.log('🔍 Scan button clicked');
                console.log('📊 Selected chains before scan:', Array.from(selectedChains));
                scanBalances();
            });
            console.log('✅ Scan listener attached');
        }
        
        if (el.sweepBtn) {
            el.sweepBtn.addEventListener('click', () => {
                console.log('💨 Sweep button clicked');
                executeSweep();
            });
            console.log('✅ Sweep listener attached');
        }
        
        // Manual address input
        if (el.walletAddressInput) {
            el.walletAddressInput.addEventListener('input', (e) => {
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
        
        // Balance checkbox changes
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('balance-checkbox')) {
                console.log('💰 Balance checkbox changed');
                estimateCosts();
            }
        });
        
        console.log('✅ All event listeners set up');
    }

    // Check existing connection
    async function checkExistingConnection() {
        const eth = getEthereum();
        if (eth && eth.selectedAddress) {
            currentAccount = eth.selectedAddress;
            const el = getElements();
            if (el.walletAddressInput) {
                el.walletAddressInput.value = currentAccount;
            }
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
                const el = getElements();
                if (el.walletAddressInput) {
                    el.walletAddressInput.value = currentAccount;
                }
                updateWalletUI();
            }
        } catch (error) {
            console.error('❌ Connection error:', error);
            showError('Failed to connect wallet: ' + error.message);
        }
    }

    // Disconnect wallet
    function disconnectWallet() {
        currentAccount = null;
        const el = getElements();
        if (el.walletAddressInput) {
            el.walletAddressInput.value = '';
        }
        updateWalletUI();
        if (el.resultsSection) {
            el.resultsSection.classList.add('hidden');
        }
    }

    // Update wallet UI
    function updateWalletUI() {
        const el = getElements();
        if (currentAccount) {
            if (el.connectWalletBtn) el.connectWalletBtn.classList.add('hidden');
            if (el.walletInfo) el.walletInfo.classList.remove('hidden');
            if (el.walletAddress) {
                el.walletAddress.textContent = `${currentAccount.slice(0, 6)}...${currentAccount.slice(-4)}`;
            }
        } else {
            if (el.connectWalletBtn) el.connectWalletBtn.classList.remove('hidden');
            if (el.walletInfo) el.walletInfo.classList.add('hidden');
        }
    }

    // Scan balances
    async function scanBalances() {
        const el = getElements();
        if (!el.walletAddressInput) {
            showError('Wallet input not found');
            return;
        }

        const address = el.walletAddressInput.value.trim();
        
        console.log('🔍 Starting balance scan...');
        console.log('📧 Address:', address);
        console.log('🔗 Selected chains:', Array.from(selectedChains));
        console.log('🔢 Selected chains count:', selectedChains.size);
        
        if (!isValidAddress(address)) {
            console.error('❌ Invalid address');
            showError('Please enter a valid wallet address');
            return;
        }

        if (selectedChains.size === 0) {
            console.error('❌ No chains selected');
            showError('Please select at least one chain');
            return;
        }

        showLoading('Scanning balances across chains...');
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

            const data = await response.json();
            console.log('📊 Scan response:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }

            scannedBalances = (data.balances || []).filter(b => b.balance > 0);
            console.log('✅ Valid balances found:', scannedBalances.length);
            
            if (scannedBalances.length === 0) {
                hideLoading();
                showInfo('No balances found across selected chains. Try selecting more chains.');
                return;
            }

            displayResults(data);
            hideLoading();
            
        } catch (error) {
            console.error('❌ Scan error:', error);
            hideLoading();
            showError('Failed to scan balances: ' + error.message);
        }
    }

    // Display results
    function displayResults(data) {
        const el = getElements();
        if (el.resultsSection) el.resultsSection.classList.remove('hidden');
        if (el.txStatusSection) el.txStatusSection.classList.add('hidden');
        
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
                            <input type="checkbox" class="balance-checkbox" data-chain="${bal.chain}" checked>
                        </span>
                    </div>
                `;
                balancesList.appendChild(balanceEl);
            });
        }

        estimateCosts();
    }

    // Estimate costs
    async function estimateCosts() {
        try {
            const destChainSelect = document.getElementById('destinationChain');
            const destinationChain = destChainSelect ? destChainSelect.value : 'ethereum';
            
            const selectedBalances = scannedBalances.filter(b => {
                const checkbox = document.querySelector(`.balance-checkbox[data-chain="${b.chain}"]`);
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
                console.error('❌ Estimate error:', data.error);
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
            console.error('❌ Estimate error:', error);
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
        console.log('💨 Starting sweep...');
        console.log('📊 Current estimates:', currentEstimates.length);
        console.log('👤 Current account:', currentAccount);
        
        if (currentEstimates.length === 0) {
            console.error('❌ No estimates found');
            showError('No balances selected. Please scan first.');
            return;
        }

        if (!currentAccount) {
            console.error('❌ No account connected');
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
            console.error('❌ Sweep error:', error);
            hideLoading();
            showError('Failed to execute sweep: ' + error.message);
        }
    }

    // Display transaction status
    function displayTransactionStatus(transactions) {
        const el = getElements();
        if (el.txStatusSection) el.txStatusSection.classList.remove('hidden');
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
        const el = getElements();
        if (el.loading) {
            const span = el.loading.querySelector('span');
            if (span) span.textContent = message;
            el.loading.classList.remove('hidden');
        }
    }

    function hideLoading() {
        const el = getElements();
        if (el.loading) el.loading.classList.add('hidden');
    }

    function showError(message) {
        console.error('❌ Error:', message);
        setTimeout(() => alert('Error: ' + message), 100);
    }

    function showSuccess(message) {
        console.log('✅ Success:', message);
        setTimeout(() => alert('Success: ' + message), 100);
    }

    function showInfo(message) {
        console.info('ℹ️ Info:', message);
        setTimeout(() => alert('Info: ' + message), 100);
    }

    // Handle account changes safely
    const eth = getEthereum();
    if (eth && typeof eth.on === 'function') {
        eth.on('accountsChanged', (accounts) => {
            if (accounts && accounts.length > 0) {
                currentAccount = accounts[0];
                const el = getElements();
                if (el.walletAddressInput) {
                    el.walletAddressInput.value = currentAccount;
                }
                updateWalletUI();
            } else {
                disconnectWallet();
            }
        });
    }

    // Initialize on DOM ready
    // IIFE pattern - call init immediately if DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready, call init immediately
        setTimeout(init, 0);
    }

    console.log('✅ ZeroDust script loaded and ready');

})();
