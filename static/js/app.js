// =============================================
// DUST.ZIP - EIP-7702 Dust Aggregator
// Complete Working Version
// =============================================

let provider = null;
let signer = null;
let userAddress = null;
let chains = {};
let selectedChains = new Set();
let scannedBalances = []; // Initialize as empty array
let ethPrice = 2500;

// =============================================
// INITIALIZATION 
// =============================================

console.log('[Dust.zip] Script loaded');

function init() {
    console.log('[Dust.zip] Initializing...');
    
    // Fetch data
    fetchEthPrice();
    fetchChains();
    
    // Setup event listeners
    const connectBtn = document.getElementById('connectBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const scanBtn = document.getElementById('scanBtn');
    const aggregateBtn = document.getElementById('aggregateBtn');
    
    if (connectBtn) connectBtn.onclick = connectWallet;
    if (selectAllBtn) selectAllBtn.onclick = selectAll;
    if (deselectAllBtn) deselectAllBtn.onclick = deselectAll;
    if (scanBtn) scanBtn.onclick = scanBalances;
    if (aggregateBtn) aggregateBtn.onclick = aggregateDust;
    
    console.log('[Dust.zip] Ready!');
}

// Run init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// =============================================
// WALLET CONNECTION
// =============================================

async function connectWallet() {
    console.log('[Dust.zip] Connecting wallet...');
    
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask!');
        return;
    }
    
    try {
        showStatus('Connecting wallet...', 'info');
        
        // Check if ethers is available
        if (typeof ethers === 'undefined') {
            throw new Error('Ethers.js not loaded');
        }
        
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        userAddress = accounts[0];
        signer = await provider.getSigner();
        
        // Update UI
        const connectText = document.getElementById('connectText');
        const connectBtn = document.getElementById('connectBtn');
        const addressInput = document.getElementById('addressInput');
        
        if (connectText) connectText.textContent = shortAddr(userAddress);
        if (connectBtn) connectBtn.classList.add('connected');
        if (addressInput) addressInput.value = userAddress;
        
        showStatus('Wallet connected!', 'success');
        console.log('[Dust.zip] Connected:', userAddress);
        
    } catch (err) {
        console.error('[Dust.zip] Connection error:', err);
        showStatus('Connection failed: ' + err.message, 'error');
    }
}

// =============================================
// CHAIN MANAGEMENT
// =============================================

async function fetchChains() {
    console.log('[Dust.zip] Fetching chains...');
    
    try {
        const res = await fetch('/api/chains');
        if (!res.ok) throw new Error('Failed to fetch chains');
        
        chains = await res.json();
        console.log('[Dust.zip] Chains loaded:', Object.keys(chains).length);
        renderChainGrid();
        
    } catch (err) {
        console.error('[Dust.zip] Chain fetch error:', err);
    }
}

function renderChainGrid() {
    const grid = document.getElementById('chainGrid');
    if (!grid) return;
    
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
    
    console.log('[Dust.zip] Chain grid rendered:', selectedChains.size);
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
        const key = el.dataset.key;
        if (key) {
            selectedChains.add(key);
            el.classList.add('selected');
        }
    });
}

function deselectAll() {
    document.querySelectorAll('.chain-item').forEach(el => {
        const key = el.dataset.key;
        if (key) {
            selectedChains.delete(key);
            el.classList.remove('selected');
        }
    });
}

// =============================================
// ETH PRICE
// =============================================

async function fetchEthPrice() {
    try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await res.json();
        if (data && data.ethereum && data.ethereum.usd) {
            ethPrice = data.ethereum.usd;
        }
        console.log('[Dust.zip] ETH price:', ethPrice);
    } catch (err) {
        console.log('[Dust.zip] Using default ETH price:', ethPrice);
    }
}

// =============================================
// BALANCE SCANNING
// =============================================

async function scanBalances() {
    console.log('[Dust.zip] Scanning balances...');
    
    const addressInput = document.getElementById('addressInput');
    const address = addressInput ? addressInput.value.trim() : '';
    
    if (!address || address.length !== 42 || !address.startsWith('0x')) {
        showStatus('Please enter a valid address (0x...)', 'error');
        return;
    }
    
    if (selectedChains.size === 0) {
        showStatus('Please select at least one chain', 'error');
        return;
    }
    
    // Show loading
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const scanBtn = document.getElementById('scanBtn');
    const loadingText = document.getElementById('loadingText');
    
    if (loading) loading.classList.remove('hidden');
    if (results) results.classList.add('hidden');
    if (scanBtn) scanBtn.disabled = true;
    if (loadingText) loadingText.textContent = `Scanning ${selectedChains.size} chains...`;
    
    try {
        await fetchEthPrice();
        
        const chainList = Array.from(selectedChains);
        console.log('[Dust.zip] Scanning chains:', chainList);
        
        const res = await fetch('/api/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address,
                chains: chainList
            })
        });
        
        if (!res.ok) {
            throw new Error('API request failed: ' + res.status);
        }
        
        const data = await res.json();
        console.log('[Dust.zip] Scan response:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Ensure balances is an array
        scannedBalances = Array.isArray(data.balances) ? data.balances : [];
        console.log('[Dust.zip] Balances:', scannedBalances.length);
        
        displayResults(data);
        showStatus('Scan complete!', 'success');
        
    } catch (err) {
        console.error('[Dust.zip] Scan error:', err);
        showStatus('Scan failed: ' + err.message, 'error');
    } finally {
        if (loading) loading.classList.add('hidden');
        if (scanBtn) scanBtn.disabled = false;
    }
}

function displayResults(data) {
    console.log('[Dust.zip] Displaying results...');
    
    const total = parseFloat(data.total) || 0;
    const fee = parseFloat(data.fee) || 0;
    const net = parseFloat(data.net) || 0;
    
    // Update totals
    const totalValue = document.getElementById('totalValue');
    const totalUsd = document.getElementById('totalUsd');
    const feeValue = document.getElementById('feeValue');
    const netValue = document.getElementById('netValue');
    
    if (totalValue) totalValue.textContent = total.toFixed(6) + ' ETH';
    if (totalUsd) totalUsd.textContent = '$' + (total * ethPrice).toFixed(2);
    if (feeValue) feeValue.textContent = fee.toFixed(6) + ' ETH';
    if (netValue) netValue.textContent = net.toFixed(6) + ' ETH';
    
    // Display balance list
    const list = document.getElementById('balanceList');
    if (!list) return;
    
    list.innerHTML = '';
    
    // Filter balances with value > 0
    const withBalance = scannedBalances.filter(b => {
        const bal = parseFloat(b.balance) || 0;
        return bal > 0;
    });
    
    console.log('[Dust.zip] Chains with balance:', withBalance.length);
    
    if (withBalance.length === 0) {
        list.innerHTML = '<div class="no-dust">No dust found on selected chains</div>';
    } else {
        withBalance.forEach(b => {
            const bal = parseFloat(b.balance) || 0;
            const div = document.createElement('div');
            div.className = 'balance-item';
            div.innerHTML = `
                <div class="bal-chain">
                    <div class="chain-dot" style="background:${b.color || '#666'}"></div>
                    <span>${b.name || 'Unknown'}</span>
                </div>
                <div class="bal-values">
                    <div class="bal-eth">${bal.toFixed(6)} ${b.symbol || 'ETH'}</div>
                    <div class="bal-usd">$${(bal * ethPrice).toFixed(2)}</div>
                </div>
            `;
            list.appendChild(div);
        });
    }
    
    // Pre-fill destination
    const destInput = document.getElementById('destInput');
    if (destInput && userAddress && !destInput.value) {
        destInput.value = userAddress;
    }
    
    // Show results
    const results = document.getElementById('results');
    if (results) results.classList.remove('hidden');
}

// =============================================
// DUST AGGREGATION
// =============================================

async function aggregateDust() {
    console.log('[Dust.zip] Starting aggregation...');
    
    const destInput = document.getElementById('destInput');
    const destination = destInput ? destInput.value.trim() : '';
    
    if (!destination || destination.length !== 42 || !destination.startsWith('0x')) {
        showStatus('Please enter a valid destination address', 'error');
        return;
    }
    
    if (!signer) {
        showStatus('Please connect your wallet first', 'error');
        return;
    }
    
    // Filter balances with enough value
    const withBalance = scannedBalances.filter(b => {
        const bal = parseFloat(b.balance) || 0;
        return bal > 0.001;
    });
    
    console.log('[Dust.zip] Chains to aggregate:', withBalance.length);
    
    if (withBalance.length === 0) {
        showStatus('No dust to aggregate (minimum 0.001)', 'error');
        return;
    }
    
    const aggregateBtn = document.getElementById('aggregateBtn');
    if (aggregateBtn) aggregateBtn.disabled = true;
    
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
        
        if (!res.ok) {
            throw new Error('API request failed: ' + res.status);
        }
        
        const data = await res.json();
        console.log('[Dust.zip] Prepared transactions:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const transactions = data.transactions || [];
        
        if (transactions.length === 0) {
            showStatus('No transactions to send', 'error');
            return;
        }
        
        // Show progress UI
        const results = document.getElementById('results');
        const txProgress = document.getElementById('txProgress');
        const txList = document.getElementById('txList');
        
        if (results) results.classList.add('hidden');
        if (txProgress) txProgress.classList.remove('hidden');
        if (txList) txList.innerHTML = '';
        
        // Group transactions by chain
        const byChain = {};
        transactions.forEach(tx => {
            const key = tx.chain_key;
            if (!byChain[key]) byChain[key] = [];
            byChain[key].push(tx);
        });
        
        let successCount = 0;
        const totalCount = transactions.length;
        
        // Execute transactions chain by chain
        for (const [chainKey, txs] of Object.entries(byChain)) {
            const chainData = chains[chainKey];
            if (!chainData) continue;
            
            // Switch to this chain
            const switched = await switchNetwork(chainData.chain_id, chainData.name);
            if (!switched) {
                console.log('[Dust.zip] Failed to switch to', chainData.name);
                continue;
            }
            
            // Refresh provider and signer after network switch
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            
            // Execute each transaction on this chain
            for (const tx of txs) {
                // Create UI element
                const txDiv = document.createElement('div');
                txDiv.className = 'tx-item pending';
                txDiv.innerHTML = `
                    <span class="tx-chain">${tx.chain_name}</span>
                    <span class="tx-type">${tx.type === 'fee' ? '💸 Fee' : '📤 Transfer'}</span>
                    <span class="tx-amount">${parseFloat(tx.value_eth).toFixed(6)}</span>
                    <span class="tx-status">⏳</span>
                `;
                if (txList) txList.appendChild(txDiv);
                
                try {
                    // Send transaction
                    const txResponse = await signer.sendTransaction({
                        to: tx.to,
                        value: ethers.toBigInt(tx.value)
                    });
                    
                    // Wait for confirmation
                    const statusEl = txDiv.querySelector('.tx-status');
                    if (statusEl) statusEl.textContent = '⏳ Confirming...';
                    
                    await txResponse.wait();
                    
                    txDiv.className = 'tx-item success';
                    if (statusEl) statusEl.textContent = '✅';
                    successCount++;
                    
                } catch (txErr) {
                    console.error('[Dust.zip] TX failed:', txErr);
                    txDiv.className = 'tx-item failed';
                    const statusEl = txDiv.querySelector('.tx-status');
                    if (statusEl) statusEl.textContent = '❌';
                }
            }
        }
        
        // Final status
        if (successCount === totalCount) {
            showStatus(`✅ Complete! ${successCount}/${totalCount} transactions sent`, 'success');
        } else if (successCount > 0) {
            showStatus(`⚠️ Partial: ${successCount}/${totalCount} transactions sent`, 'info');
        } else {
            showStatus('❌ No transactions completed', 'error');
        }
        
    } catch (err) {
        console.error('[Dust.zip] Aggregation error:', err);
        showStatus('Aggregation failed: ' + err.message, 'error');
    } finally {
        if (aggregateBtn) aggregateBtn.disabled = false;
    }
}

// =============================================
// NETWORK SWITCHING
// =============================================

async function switchNetwork(chainId, chainName) {
    console.log('[Dust.zip] Switching to', chainName, chainId);
    
    const hexChainId = '0x' + chainId.toString(16);
    
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }]
        });
        return true;
    } catch (err) {
        if (err.code === 4902) {
            showStatus(`Please add ${chainName} to MetaMask`, 'error');
        } else {
            console.error('[Dust.zip] Switch failed:', err);
        }
        return false;
    }
}

// =============================================
// UTILITIES
// =============================================

function shortAddr(addr) {
    if (!addr || addr.length < 10) return addr || '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function showStatus(msg, type) {
    console.log('[Dust.zip] Status:', type, msg);
    
    const el = document.getElementById('status');
    if (!el) return;
    
    el.textContent = msg;
    el.className = 'status ' + type;
    el.classList.remove('hidden');
    
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            el.classList.add('hidden');
        }, 5000);
    }
}
