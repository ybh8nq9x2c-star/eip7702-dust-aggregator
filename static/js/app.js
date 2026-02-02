// =============================================
// DUST.ZIP - EIP-7702 Dust Aggregator
// =============================================

let provider = null;
let signer = null;
let userAddress = null;
let chains = {};
let selectedChains = new Set();
let scannedBalances = [];
let ethPrice = 0;

// =============================================
// INITIALIZATION
// =============================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[Dust.zip] Initializing...');
    
    // Check ethers
    if (typeof ethers === 'undefined') {
        showStatus('Error: Ethers.js not loaded', 'error');
        return;
    }
    
    // Fetch data
    await fetchEthPrice();
    await fetchChains();
    
    // Setup listeners
    setupEventListeners();
    
    console.log('[Dust.zip] Ready!');
});

function setupEventListeners() {
    document.getElementById('connectBtn').onclick = connectWallet;
    document.getElementById('selectAllBtn').onclick = selectAll;
    document.getElementById('deselectAllBtn').onclick = deselectAll;
    document.getElementById('scanBtn').onclick = scanBalances;
    document.getElementById('aggregateBtn').onclick = aggregateDust;
}

// =============================================
// WALLET CONNECTION
// =============================================

async function connectWallet() {
    if (!window.ethereum) {
        alert('Please install MetaMask!');
        return;
    }
    
    try {
        showStatus('Connecting...', 'info');
        
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        userAddress = accounts[0];
        signer = await provider.getSigner();
        
        // Update UI
        document.getElementById('connectText').textContent = shortAddr(userAddress);
        document.getElementById('connectBtn').classList.add('connected');
        document.getElementById('addressInput').value = userAddress;
        
        showStatus('Wallet connected!', 'success');
        
    } catch (err) {
        showStatus('Connection failed: ' + err.message, 'error');
    }
}

// =============================================
// CHAIN MANAGEMENT
// =============================================

async function fetchChains() {
    try {
        const res = await fetch('/api/chains');
        chains = await res.json();
        renderChainGrid();
    } catch (err) {
        console.error('Failed to fetch chains:', err);
    }
}

function renderChainGrid() {
    const grid = document.getElementById('chainGrid');
    grid.innerHTML = '';
    
    Object.entries(chains).forEach(([key, chain]) => {
        selectedChains.add(key);
        
        const div = document.createElement('div');
        div.className = 'chain-item selected';
        div.dataset.key = key;
        div.innerHTML = `
            <div class="chain-check">✓</div>
            <div class="chain-dot" style="background:${chain.color}"></div>
            <span>${chain.name}</span>
        `;
        div.onclick = () => toggleChain(key, div);
        grid.appendChild(div);
    });
}

function toggleChain(key, el) {
    if (selectedChains.has(key)) {
        selectedChains.delete(key);
        el.classList.remove('selected');
    } else {
        selectedChains.add(key);
        el.classList.add('selected');
    }
}

function selectAll() {
    document.querySelectorAll('.chain-item').forEach(el => {
        selectedChains.add(el.dataset.key);
        el.classList.add('selected');
    });
}

function deselectAll() {
    document.querySelectorAll('.chain-item').forEach(el => {
        selectedChains.delete(el.dataset.key);
        el.classList.remove('selected');
    });
}

// =============================================
// BALANCE SCANNING
// =============================================

async function fetchEthPrice() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await res.json();
        ethPrice = data.ethereum?.usd || 2500;
    } catch {
        ethPrice = 2500;
    }
}

async function scanBalances() {
    const address = document.getElementById('addressInput').value.trim();
    
    if (!address || address.length !== 42) {
        showStatus('Enter a valid address', 'error');
        return;
    }
    
    if (selectedChains.size === 0) {
        showStatus('Select at least one chain', 'error');
        return;
    }
    
    // Show loading
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('loadingText').textContent = `Scanning ${selectedChains.size} chains...`;
    document.getElementById('scanBtn').disabled = true;
    
    try {
        await fetchEthPrice();
        
        const res = await fetch('/api/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address,
                chains: Array.from(selectedChains)
            })
        });
        
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        scannedBalances = data.balances;
        displayResults(data);
        
    } catch (err) {
        showStatus('Scan failed: ' + err.message, 'error');
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('scanBtn').disabled = false;
    }
}

function displayResults(data) {
    const total = data.total || 0;
    const fee = data.fee || 0;
    const net = data.net || 0;
    
    document.getElementById('totalValue').textContent = formatEth(total);
    document.getElementById('totalUsd').textContent = formatUsd(total);
    document.getElementById('feeValue').textContent = formatEth(fee);
    document.getElementById('netValue').textContent = formatEth(net);
    
    const list = document.getElementById('balanceList');
    list.innerHTML = '';
    
    const withBalance = scannedBalances.filter(b => b.balance > 0);
    
    if (withBalance.length === 0) {
        list.innerHTML = '<div class="no-dust">No dust found</div>';
    } else {
        withBalance.forEach(b => {
            const div = document.createElement('div');
            div.className = 'balance-item';
            div.innerHTML = `
                <div class="bal-chain">
                    <div class="chain-dot" style="background:${b.color}"></div>
                    <span>${b.name}</span>
                </div>
                <div class="bal-values">
                    <div class="bal-eth">${formatEth(b.balance)} ${b.symbol}</div>
                    <div class="bal-usd">${formatUsd(b.balance)}</div>
                </div>
            `;
            list.appendChild(div);
        });
    }
    
    // Pre-fill destination with user address
    if (userAddress && !document.getElementById('destInput').value) {
        document.getElementById('destInput').value = userAddress;
    }
    
    document.getElementById('results').classList.remove('hidden');
}

// =============================================
// DUST AGGREGATION
// =============================================

async function aggregateDust() {
    const destination = document.getElementById('destInput').value.trim();
    
    if (!destination || destination.length !== 42) {
        showStatus('Enter valid destination address', 'error');
        return;
    }
    
    if (!signer) {
        showStatus('Please connect wallet first', 'error');
        return;
    }
    
    const withBalance = scannedBalances.filter(b => b.balance > 0.001);
    
    if (withBalance.length === 0) {
        showStatus('No dust to aggregate (min 0.001)', 'error');
        return;
    }
    
    document.getElementById('aggregateBtn').disabled = true;
    showStatus('Preparing transactions...', 'info');
    
    try {
        // Get prepared transactions from backend
        const res = await fetch('/api/prepare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                balances: withBalance,
                destination: destination
            })
        });
        
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);
        
        const transactions = data.transactions || [];
        
        if (transactions.length === 0) {
            showStatus('No transactions to send', 'error');
            return;
        }
        
        // Show progress
        document.getElementById('results').classList.add('hidden');
        document.getElementById('txProgress').classList.remove('hidden');
        
        const txList = document.getElementById('txList');
        txList.innerHTML = '';
        
        // Group by chain
        const byChain = {};
        transactions.forEach(tx => {
            if (!byChain[tx.chain_key]) byChain[tx.chain_key] = [];
            byChain[tx.chain_key].push(tx);
        });
        
        let success = 0;
        let total = transactions.length;
        
        // Execute transactions chain by chain
        for (const [chainKey, txs] of Object.entries(byChain)) {
            const chainData = chains[chainKey];
            if (!chainData) continue;
            
            // Switch network
            const switched = await switchNetwork(chainData.chain_id, chainData.name);
            if (!switched) continue;
            
            // Refresh signer
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            
            // Execute each tx on this chain
            for (const tx of txs) {
                const txDiv = document.createElement('div');
                txDiv.className = 'tx-item pending';
                txDiv.innerHTML = `
                    <span class="tx-chain">${tx.chain_name}</span>
                    <span class="tx-type">${tx.type === 'fee' ? '💸 Fee' : '📤 Transfer'}</span>
                    <span class="tx-amount">${formatEth(tx.value_eth)}</span>
                    <span class="tx-status">⏳</span>
                `;
                txList.appendChild(txDiv);
                
                try {
                    const txResponse = await signer.sendTransaction({
                        to: tx.to,
                        value: ethers.toBigInt(tx.value)
                    });
                    
                    txDiv.querySelector('.tx-status').textContent = '⏳ Confirming...';
                    await txResponse.wait();
                    
                    txDiv.className = 'tx-item success';
                    txDiv.querySelector('.tx-status').textContent = '✅';
                    success++;
                    
                } catch (txErr) {
                    txDiv.className = 'tx-item failed';
                    txDiv.querySelector('.tx-status').textContent = '❌';
                    console.error('TX failed:', txErr);
                }
            }
        }
        
        // Final status
        if (success === total) {
            showStatus(`✅ Complete! ${success}/${total} transactions sent`, 'success');
        } else {
            showStatus(`⚠️ Completed ${success}/${total} transactions`, 'info');
        }
        
    } catch (err) {
        showStatus('Aggregation failed: ' + err.message, 'error');
    } finally {
        document.getElementById('aggregateBtn').disabled = false;
    }
}

// =============================================
// NETWORK SWITCHING
// =============================================

async function switchNetwork(chainId, chainName) {
    const hex = '0x' + chainId.toString(16);
    
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hex }]
        });
        return true;
    } catch (err) {
        if (err.code === 4902) {
            showStatus(`Add ${chainName} to MetaMask`, 'error');
        }
        return false;
    }
}

// =============================================
// UTILITIES
// =============================================

function formatEth(val) {
    return (parseFloat(val) || 0).toFixed(6) + ' ETH';
}

function formatUsd(ethVal) {
    const usd = (parseFloat(ethVal) || 0) * ethPrice;
    return '$' + usd.toFixed(2);
}

function shortAddr(addr) {
    return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
}

function showStatus(msg, type) {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + type;
    el.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}
