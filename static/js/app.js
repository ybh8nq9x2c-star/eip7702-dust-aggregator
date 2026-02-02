// Global state
let connectedAddress = null;
let provider = null;
let signer = null;
let balances = [];
let ethPrice = 0;
let chains = {};
let selectedChains = new Set();

// Initialize immediately or wait for DOM
(function() {
    console.log('App.js loaded, readyState:', document.readyState);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready, init immediately
        init();
    }
})();

async function init() {
    console.log('=== INITIALIZING APP ===');
    
    // Verify ethers is loaded
    if (typeof ethers === 'undefined') {
        console.error('Ethers.js not loaded!');
        return;
    }
    console.log('Ethers.js version:', ethers.version);
    
    await fetchEthPrice();
    await fetchChains();
    setupEventListeners();
    
    console.log('=== APP READY ===');
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    const connectBtn = document.getElementById('connectWallet');
    const selectAllBtn = document.getElementById('selectAll');
    const deselectAllBtn = document.getElementById('deselectAll');
    const scanBtn = document.getElementById('scanBtn');
    const aggregateBtn = document.getElementById('aggregateBtn');
    
    if (connectBtn) {
        console.log('Connect button found, adding listener');
        connectBtn.onclick = function() {
            console.log('Connect button clicked!');
            connectWallet();
        };
    } else {
        console.error('Connect button NOT found!');
    }
    
    if (selectAllBtn) selectAllBtn.onclick = selectAllChains;
    if (deselectAllBtn) deselectAllBtn.onclick = deselectAllChains;
    if (scanBtn) scanBtn.onclick = scanBalances;
    if (aggregateBtn) aggregateBtn.onclick = aggregateDust;
    
    console.log('Event listeners setup complete');
}

// Fetch ETH price
async function fetchEthPrice() {
    console.log('Fetching ETH price...');
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
                console.log('ETH Price:', ethPrice);
                return;
            }
        } catch (e) {
            console.warn('Price API failed:', api);
        }
    }
    ethPrice = 2500;
    console.log('Using fallback ETH price:', ethPrice);
}

// Fetch chains
async function fetchChains() {
    console.log('Fetching chains...');
    try {
        const response = await fetch('/api/chains');
        chains = await response.json();
        console.log('Chains loaded:', Object.keys(chains).length);
        populateChainGrid();
    } catch (error) {
        console.error('Failed to fetch chains:', error);
    }
}

// Populate chain grid
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
        item.onclick = function() { toggleChain(key, item); };
        chainGrid.appendChild(item);
    }
}

// Toggle chain
function toggleChain(key, item) {
    if (selectedChains.has(key)) {
        selectedChains.delete(key);
        item.classList.remove('selected');
    } else {
        selectedChains.add(key);
        item.classList.add('selected');
    }
}

// Select all chains
function selectAllChains() {
    document.querySelectorAll('.chain-item').forEach(function(item) {
        selectedChains.add(item.dataset.chain);
        item.classList.add('selected');
    });
}

// Deselect all chains
function deselectAllChains() {
    document.querySelectorAll('.chain-item').forEach(function(item) {
        selectedChains.delete(item.dataset.chain);
        item.classList.remove('selected');
    });
}

// Connect wallet
async function connectWallet() {
    console.log('=== CONNECT WALLET CALLED ===' );
    
    // Check for MetaMask
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        showStatus('Please install MetaMask or another Web3 wallet!', 'error');
        return;
    }
    console.log('MetaMask detected');
    
    // Check ethers
    if (typeof ethers === 'undefined') {
        alert('Web3 library not loaded. Please refresh.');
        return;
    }
    console.log('Ethers available');
    
    try {
        showStatus('Connecting to MetaMask...', 'info');
        
        provider = new ethers.BrowserProvider(window.ethereum);
        console.log('Provider created');
        
        const accounts = await provider.send('eth_requestAccounts', []);
        console.log('Accounts:', accounts);
        
        connectedAddress = accounts[0];
        signer = await provider.getSigner();
        
        // Update UI
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
        alert('Connection failed: ' + error.message);
        showStatus('Failed to connect: ' + error.message, 'error');
    }
}

// Helper functions
function shortenAddress(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatEth(value) {
    return (parseFloat(value) || 0).toFixed(6);
}

function formatUsd(ethValue) {
    const usd = (parseFloat(ethValue) || 0) * ethPrice;
    return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
    console.log('Scanning balances...');
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
        console.log('Balance data:', data);
        
        if (data.error) throw new Error(data.error);
        
        balances = data.balances || [];
        displayResults(data);
        
    } catch (error) {
        console.error('Scan error:', error);
        showStatus('Scan failed: ' + error.message, 'error');
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
    
    document.getElementById('totalEth').textContent = formatEth(totalEth) + ' ETH';
    document.getElementById('totalUsd').textContent = formatUsd(totalEth);
    document.getElementById('feeAmount').textContent = formatEth(fee) + ' ETH (' + formatUsd(fee) + ')';
    document.getElementById('afterFeeAmount').textContent = formatEth(afterFee) + ' ETH (' + formatUsd(afterFee) + ')';
    
    const balanceList = document.getElementById('balanceList');
    balanceList.innerHTML = '';
    
    const chainsWithBalance = balances.filter(b => parseFloat(b.balance) > 0);
    
    if (chainsWithBalance.length === 0) {
        balanceList.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.5);padding:20px;">No dust found</p>';
    } else {
        chainsWithBalance.forEach(function(b) {
            const bal = parseFloat(b.balance) || 0;
            const item = document.createElement('div');
            item.className = 'balance-item';
            item.innerHTML = '<div class="balance-chain">' +
                '<div class="chain-dot" style="background:' + (b.color || '#666') + '"></div>' +
                '<span>' + b.chain + '</span>' +
                '</div>' +
                '<div class="balance-values">' +
                '<div class="balance-eth">' + formatEth(bal) + ' ' + (b.symbol || 'ETH') + '</div>' +
                '<div class="balance-usd">' + formatUsd(bal) + '</div>' +
                '</div>';
            balanceList.appendChild(item);
        });
    }
    
    document.getElementById('results').classList.remove('hidden');
}

// Aggregate dust
async function aggregateDust() {
    const destination = document.getElementById('destinationAddress').value.trim();
    
    if (!destination || !destination.startsWith('0x') || destination.length !== 42) {
        showStatus('Please enter a valid destination address', 'error');
        return;
    }
    
    const chainsWithBalance = balances.filter(b => parseFloat(b.balance) > 0.0001);
    
    if (chainsWithBalance.length === 0) {
        showStatus('No balances to aggregate', 'error');
        return;
    }
    
    if (!signer) {
        showStatus('Please connect your wallet first', 'error');
        return;
    }
    
    document.getElementById('aggregateBtn').disabled = true;
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
        if (data.error) throw new Error(data.error);
        
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
                console.error('TX error:', txError);
            }
        }
        
        showStatus('Done! ' + successCount + '/' + data.transactions.length + ' transactions sent.', 'success');
        
    } catch (error) {
        console.error('Aggregation error:', error);
        showStatus('Failed: ' + error.message, 'error');
    } finally {
        document.getElementById('aggregateBtn').disabled = false;
    }
}
