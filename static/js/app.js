// Global state
let connectedAddress = null;
let provider = null;
let signer = null;
let balances = [];
let ethPrice = 0;
let chains = {};
let selectedChains = new Set();

// DOM Elements
const connectBtn = document.getElementById('connectWallet');
const walletBtnText = document.getElementById('walletBtnText');
const walletInput = document.getElementById('walletAddress');
const chainGrid = document.getElementById('chainGrid');
const selectAllBtn = document.getElementById('selectAll');
const deselectAllBtn = document.getElementById('deselectAll');
const scanBtn = document.getElementById('scanBtn');
const loadingDiv = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const balanceList = document.getElementById('balanceList');
const totalEthSpan = document.getElementById('totalEth');
const totalUsdSpan = document.getElementById('totalUsd');
const feeAmountSpan = document.getElementById('feeAmount');
const afterFeeSpan = document.getElementById('afterFeeAmount');
const destinationInput = document.getElementById('destinationAddress');
const aggregateBtn = document.getElementById('aggregateBtn');
const statusDiv = document.getElementById('status');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await fetchEthPrice();
    await fetchChains();
    setupEventListeners();
});

// Fetch ETH price from CoinGecko
async function fetchEthPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        ethPrice = data.ethereum.usd;
        console.log('ETH Price:', ethPrice);
    } catch (error) {
        console.error('Failed to fetch ETH price:', error);
        ethPrice = 2500;
    }
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
    chainGrid.innerHTML = '';
    for (const [key, chain] of Object.entries(chains)) {
        selectedChains.add(key);
        const item = document.createElement('div');
        item.className = 'chain-item selected';
        item.dataset.chain = key;
        item.innerHTML = `
            <div class="chain-checkbox"></div>
            <div class="chain-color" style="background: ${chain.color}"></div>
            <span class="chain-name">${chain.name}</span>
        `;
        item.addEventListener('click', () => toggleChain(key, item));
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
    connectBtn.addEventListener('click', connectWallet);
    selectAllBtn.addEventListener('click', selectAllChains);
    deselectAllBtn.addEventListener('click', deselectAllChains);
    scanBtn.addEventListener('click', scanBalances);
    aggregateBtn.addEventListener('click', aggregateDust);
}

// Select all chains
function selectAllChains() {
    document.querySelectorAll('.chain-item').forEach(item => {
        const key = item.dataset.chain;
        selectedChains.add(key);
        item.classList.add('selected');
    });
}

// Deselect all chains
function deselectAllChains() {
    document.querySelectorAll('.chain-item').forEach(item => {
        const key = item.dataset.chain;
        selectedChains.delete(key);
        item.classList.remove('selected');
    });
}

// Connect wallet
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showStatus('Please install MetaMask!', 'error');
        return;
    }
    try {
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        connectedAddress = accounts[0];
        signer = await provider.getSigner();
        walletBtnText.textContent = shortenAddress(connectedAddress);
        connectBtn.classList.add('connected');
        walletInput.value = connectedAddress;
        showStatus('Wallet connected!', 'success');
    } catch (error) {
        console.error('Connection error:', error);
        showStatus('Failed to connect wallet', 'error');
    }
}

// Shorten address
function shortenAddress(addr) {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

// Format ETH value
function formatEth(value) {
    return parseFloat(value).toFixed(6);
}

// Format USD value
function formatUsd(ethValue) {
    const usd = parseFloat(ethValue) * ethPrice;
    return '$' + usd.toFixed(2);
}

// Show status
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status ' + type;
    statusDiv.classList.remove('hidden');
    if (type === 'success') {
        setTimeout(() => statusDiv.classList.add('hidden'), 3000);
    }
}

// Scan balances
async function scanBalances() {
    const address = walletInput.value.trim();
    if (!address || !address.startsWith('0x') || address.length !== 42) {
        showStatus('Please enter a valid wallet address', 'error');
        return;
    }
    if (selectedChains.size === 0) {
        showStatus('Please select at least one chain', 'error');
        return;
    }
    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    statusDiv.classList.add('hidden');
    scanBtn.disabled = true;
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
        showStatus('Failed to scan balances: ' + error.message, 'error');
    } finally {
        loadingDiv.classList.add('hidden');
        scanBtn.disabled = false;
    }
}

// Display results
function displayResults(data) {
    const totalEth = parseFloat(data.total_balance) || 0;
    const fee = totalEth * 0.05;
    const afterFee = totalEth - fee;
    totalEthSpan.textContent = formatEth(totalEth) + ' ETH';
    totalUsdSpan.textContent = formatUsd(totalEth);
    feeAmountSpan.textContent = formatEth(fee) + ' ETH (' + formatUsd(fee) + ')';
    afterFeeSpan.textContent = formatEth(afterFee) + ' ETH (' + formatUsd(afterFee) + ')';
    balanceList.innerHTML = '';
    if (balances.length === 0) {
        balanceList.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,0.5);padding:20px;">No dust found on selected chains</p>';
    } else {
        balances.forEach(b => {
            const bal = parseFloat(b.balance) || 0;
            if (bal > 0) {
                const item = document.createElement('div');
                item.className = 'balance-item';
                item.innerHTML = `
                    <div class="balance-chain">
                        <div class="chain-dot" style="background: ${b.color}"></div>
                        <span class="chain-name">${b.chain}</span>
                    </div>
                    <div class="balance-values">
                        <div class="balance-eth">${formatEth(bal)} ${b.symbol}</div>
                        <div class="balance-usd">${formatUsd(bal)}</div>
                    </div>
                `;
                balanceList.appendChild(item);
            }
        });
    }
    resultsDiv.classList.remove('hidden');
}

// Aggregate dust
async function aggregateDust() {
    const destination = destinationInput.value.trim();
    if (!destination || !destination.startsWith('0x') || destination.length !== 42) {
        showStatus('Please enter a valid destination address', 'error');
        return;
    }
    if (balances.length === 0) {
        showStatus('No balances to aggregate', 'error');
        return;
    }
    if (!signer) {
        showStatus('Please connect your wallet first', 'error');
        return;
    }
    aggregateBtn.disabled = true;
    showStatus('Preparing transactions...', 'info');
    try {
        const response = await fetch('/api/aggregate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: connectedAddress,
                destination: destination,
                destination_chain: document.getElementById('destinationChain').value,
                balances: balances
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
                showStatus('Sending transaction on ' + tx.chain + '...', 'info');
                provider = new ethers.BrowserProvider(window.ethereum);
                signer = await provider.getSigner();
                const txResponse = await signer.sendTransaction({
                    to: tx.to,
                    value: ethers.parseEther(tx.value)
                });
                showStatus('Waiting for confirmation on ' + tx.chain + '...', 'info');
                await txResponse.wait();
                successCount++;
            } catch (txError) {
                console.error('Transaction error on ' + tx.chain + ':', txError);
            }
        }
        showStatus('Aggregation complete! ' + successCount + ' transactions sent.', 'success');
    } catch (error) {
        console.error('Aggregation error:', error);
        showStatus('Aggregation failed: ' + error.message, 'error');
    } finally {
        aggregateBtn.disabled = false;
    }
}
