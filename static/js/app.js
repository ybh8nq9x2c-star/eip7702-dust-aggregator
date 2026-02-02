// Global state
let connectedAddress = null;
let provider = null;
let signer = null;
let balances = [];
let ethPrice = 0;
let chains = {};
let selectedChains = new Set();

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('Initializing app...');
    await fetchEthPrice();
    await fetchChains();
    setupEventListeners();
    console.log('App initialized, ETH price:', ethPrice);
}

// Fetch ETH price from multiple sources
async function fetchEthPrice() {
    const apis = [
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
        'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD'
    ];
    
    for (const api of apis) {
        try {
            const response = await fetch(api);
            const data = await response.json();
            if (data.ethereum && data.ethereum.usd) {
                ethPrice = data.ethereum.usd;
            } else if (data.USD) {
                ethPrice = data.USD;
            }
            if (ethPrice > 0) {
                console.log('ETH Price fetched:', ethPrice);
                return;
            }
        } catch (error) {
            console.warn('Price API failed:', api, error);
        }
    }
    ethPrice = 2500;
    console.log('Using fallback ETH price:', ethPrice);
}

// Fetch chains from API
async function fetchChains() {
    try {
        const response = await fetch('/api/chains');
        chains = await response.json();
        populateChainGrid();
    } catch (error) {
        console.error('Failed to fetch chains:', error);
        showStatus('Failed to load chains', 'error');
    }
}

// Populate chain selection grid
function populateChainGrid() {
    const chainGrid = document.getElementById('chainGrid');
    if (!chainGrid) return;
    
    chainGrid.innerHTML = '';
    for (const [key, chain] of Object.entries(chains)) {
        selectedChains.add(key);
        const item = document.createElement('div');
        item.className = 'chain-item selected';
        item.dataset.chain = key;
        item.innerHTML = '<div class="chain-checkbox"></div>' +
            '<div class="chain-color" style="background:' + chain.color + '"></div>' +
            '<span class="chain-name">' + chain.name + '</span>';
        item.addEventListener('click', function() { toggleChain(key, item); });
        chainGrid.appendChild(item);
    }
}

// Toggle chain selection
function toggleChain(key, item) {
    if (selectedChains.has(key)) {
        selectedChains.delete(key);
        item.classList.remove('selected');
    } else {
        selectedChains.add(key);
        item.classList.add('selected');
    }
}

// Setup event listeners
function setupEventListeners() {
    const connectBtn = document.getElementById('connectWallet');
    const selectAllBtn = document.getElementById('selectAll');
    const deselectAllBtn = document.getElementById('deselectAll');
    const scanBtn = document.getElementById('scanBtn');
    const aggregateBtn = document.getElementById('aggregateBtn');
    
    if (connectBtn) connectBtn.addEventListener('click', connectWallet);
    if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllChains);
    if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAllChains);
    if (scanBtn) scanBtn.addEventListener('click', scanBalances);
    if (aggregateBtn) aggregateBtn.addEventListener('click', aggregateDust);
}

// Select all chains
function selectAllChains() {
    document.querySelectorAll('.chain-item').forEach(function(item) {
        const key = item.dataset.chain;
        selectedChains.add(key);
        item.classList.add('selected');
    });
}

// Deselect all chains
function deselectAllChains() {
    document.querySelectorAll('.chain-item').forEach(function(item) {
        const key = item.dataset.chain;
        selectedChains.delete(key);
        item.classList.remove('selected');
    });
}

// Connect wallet
async function connectWallet() {
    console.log('Connecting wallet...');
    
    if (typeof window.ethereum === 'undefined') {
        showStatus('Please install MetaMask or another Web3 wallet!', 'error');
        return;
    }
    
    try {
        if (typeof ethers === 'undefined') {
            showStatus('Web3 library not loaded. Please refresh.', 'error');
            return;
        }
        
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        connectedAddress = accounts[0];
        signer = await provider.getSigner();
        
        const walletBtnText = document.getElementById('walletBtnText');
        const connectBtn = document.getElementById('connectWallet');
        const walletInput = document.getElementById('walletAddress');
        
        if (walletBtnText) walletBtnText.textContent = shortenAddress(connectedAddress);
        if (connectBtn) connectBtn.classList.add('connected');
        if (walletInput) walletInput.value = connectedAddress;
        
        showStatus('Wallet connected: ' + shortenAddress(connectedAddress), 'success');
        console.log('Wallet connected:', connectedAddress);
        
    } catch (error) {
        console.error('Connection error:', error);
        showStatus('Failed to connect wallet: ' + error.message, 'error');
    }
}

// Shorten address
function shortenAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// Format ETH value
function formatEth(value) {
    const num = parseFloat(value) || 0;
    return num.toFixed(6);
}

// Format USD value
function formatUsd(ethValue) {
    const eth = parseFloat(ethValue) || 0;
    const usd = eth * ethPrice;
    return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Show status message
function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(function() { statusDiv.classList.add('hidden'); }, 3000);
    }
}

// Scan balances
async function scanBalances() {
    const walletInput = document.getElementById('walletAddress');
    const address = walletInput ? walletInput.value.trim() : '';
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
        showStatus('Please enter a valid wallet address', 'error');
        return;
    }
    
    if (selectedChains.size === 0) {
        showStatus('Please select at least one chain', 'error');
        return;
    }
    
    const loadingDiv = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    const resultsDiv = document.getElementById('results');
    const scanBtn = document.getElementById('scanBtn');
    const statusDiv = document.getElementById('status');
    
    if (loadingDiv) loadingDiv.classList.remove('hidden');
    if (resultsDiv) resultsDiv.classList.add('hidden');
    if (statusDiv) statusDiv.classList.add('hidden');
    if (scanBtn) scanBtn.disabled = true;
    if (loadingText) loadingText.textContent = 'Scanning ' + selectedChains.size + ' chains...';
    
    try {
        await fetchEthPrice();
        
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
        
        balances = data.balances || [];
        displayResults(data);
        
    } catch (error) {
        console.error('Scan error:', error);
        showStatus('Failed to scan: ' + error.message, 'error');
    } finally {
        if (loadingDiv) loadingDiv.classList.add('hidden');
        if (scanBtn) scanBtn.disabled = false;
    }
}

// Display results
function displayResults(data) {
    const totalEth = parseFloat(data.total_balance) || 0;
    const fee = totalEth * 0.05;
    const afterFee = totalEth - fee;
    
    const totalEthSpan = document.getElementById('totalEth');
    const totalUsdSpan = document.getElementById('totalUsd');
    const feeAmountSpan = document.getElementById('feeAmount');
    const afterFeeSpan = document.getElementById('afterFeeAmount');
    const balanceList = document.getElementById('balanceList');
    const resultsDiv = document.getElementById('results');
    
    if (totalEthSpan) totalEthSpan.textContent = formatEth(totalEth) + ' ETH';
    if (totalUsdSpan) totalUsdSpan.textContent = formatUsd(totalEth);
    if (feeAmountSpan) feeAmountSpan.textContent = formatEth(fee) + ' ETH (' + formatUsd(fee) + ')';
    if (afterFeeSpan) afterFeeSpan.textContent = formatEth(afterFee) + ' ETH (' + formatUsd(afterFee) + ')';
    
    if (balanceList) {
        balanceList.innerHTML = '';
        
        const chainsWithBalance = balances.filter(function(b) { return parseFloat(b.balance) > 0; });
        
        if (chainsWithBalance.length === 0) {
            balanceList.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.5);padding:20px;">No dust found on selected chains</p>';
        } else {
            chainsWithBalance.forEach(function(b) {
                const bal = parseFloat(b.balance) || 0;
                const item = document.createElement('div');
                item.className = 'balance-item';
                item.innerHTML = '<div class="balance-chain">' +
                    '<div class="chain-dot" style="background:' + b.color + '"></div>' +
                    '<span class="chain-name">' + b.chain + '</span>' +
                '</div>' +
                '<div class="balance-values">' +
                    '<div class="balance-eth">' + formatEth(bal) + ' ' + b.symbol + '</div>' +
                    '<div class="balance-usd">' + formatUsd(bal) + '</div>' +
                '</div>';
                balanceList.appendChild(item);
            });
        }
    }
    
    if (resultsDiv) resultsDiv.classList.remove('hidden');
}

// Aggregate dust
async function aggregateDust() {
    const destinationInput = document.getElementById('destinationAddress');
    const destination = destinationInput ? destinationInput.value.trim() : '';
    
    if (!destination || !destination.startsWith('0x') || destination.length !== 42) {
        showStatus('Please enter a valid destination address', 'error');
        return;
    }
    
    const chainsWithBalance = balances.filter(function(b) { return parseFloat(b.balance) > 0.0001; });
    
    if (chainsWithBalance.length === 0) {
        showStatus('No balances to aggregate', 'error');
        return;
    }
    
    if (!signer) {
        showStatus('Please connect your wallet first', 'error');
        return;
    }
    
    const aggregateBtn = document.getElementById('aggregateBtn');
    if (aggregateBtn) aggregateBtn.disabled = true;
    
    showStatus('Preparing transactions...', 'info');
    
    try {
        const response = await fetch('/api/aggregate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: connectedAddress,
                destination: destination,
                destination_chain: document.getElementById('destinationChain').value,
                balances: chainsWithBalance
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        let successCount = 0;
        for (const tx of data.transactions) {
            try {
                showStatus('Switching to ' + tx.chain + '...', 'info');
                
                try {
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: tx.chainId }]
                    });
                } catch (switchError) {
                    if (switchError.code === 4902) {
                        showStatus('Please add ' + tx.chain + ' to MetaMask', 'error');
                        continue;
                    }
                    throw switchError;
                }
                
                showStatus('Sending on ' + tx.chain + '...', 'info');
                
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                
                const txResponse = await signer.sendTransaction({
                    to: tx.to,
                    value: ethers.parseEther(tx.value)
                });
                
                showStatus('Confirming on ' + tx.chain + '...', 'info');
                await txResponse.wait();
                successCount++;
                
            } catch (txError) {
                console.error('TX error on ' + tx.chain + ':', txError);
            }
        }
        
        showStatus('Complete! ' + successCount + '/' + data.transactions.length + ' transactions sent.', 'success');
        
    } catch (error) {
        console.error('Aggregation error:', error);
        showStatus('Aggregation failed: ' + error.message, 'error');
    } finally {
        if (aggregateBtn) aggregateBtn.disabled = false;
    }
}
