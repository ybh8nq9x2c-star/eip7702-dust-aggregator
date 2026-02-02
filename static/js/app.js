// ============================================
// DUST.ZIP - EIP-7702 Cross-Chain Aggregator
// ============================================

// Global state
let connectedAddress = null;
let provider = null;
let signer = null;
let balances = [];
let ethPrice = 0;
let chains = {};
let selectedChains = new Set();

// Initialize
(function() {
    console.log('[Dust.zip] Loading...');
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

async function init() {
    console.log('[Dust.zip] Initializing...');
    
    if (typeof ethers === 'undefined') {
        console.error('[Dust.zip] Ethers.js not loaded!');
        showStatus('Error: Web3 library not loaded. Refresh page.', 'error');
        return;
    }
    
    await fetchEthPrice();
    await fetchChains();
    setupEventListeners();
    
    console.log('[Dust.zip] Ready! ETH Price: $' + ethPrice);
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    const connectBtn = document.getElementById('connectWallet');
    const selectAllBtn = document.getElementById('selectAll');
    const deselectAllBtn = document.getElementById('deselectAll');
    const scanBtn = document.getElementById('scanBtn');
    const aggregateBtn = document.getElementById('aggregateBtn');
    
    if (connectBtn) {
        connectBtn.onclick = connectWallet;
        console.log('[Dust.zip] Connect button ready');
    }
    if (selectAllBtn) selectAllBtn.onclick = selectAllChains;
    if (deselectAllBtn) deselectAllBtn.onclick = deselectAllChains;
    if (scanBtn) scanBtn.onclick = scanBalances;
    if (aggregateBtn) aggregateBtn.onclick = aggregateDust;
}

// ============================================
// WALLET CONNECTION
// ============================================

async function connectWallet() {
    console.log('[Dust.zip] Connecting wallet...');
    
    if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet!');
        showStatus('MetaMask not found. Please install it.', 'error');
        return;
    }
    
    try {
        showStatus('Connecting to wallet...', 'info');
        
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        connectedAddress = accounts[0];
        signer = await provider.getSigner();
        
        // Update UI
        document.getElementById('walletBtnText').textContent = shortenAddress(connectedAddress);
        document.getElementById('connectWallet').classList.add('connected');
        document.getElementById('walletAddress').value = connectedAddress;
        
        showStatus('✓ Wallet connected: ' + shortenAddress(connectedAddress), 'success');
        console.log('[Dust.zip] Connected:', connectedAddress);
        
    } catch (error) {
        console.error('[Dust.zip] Connection error:', error);
        showStatus('Connection failed: ' + error.message, 'error');
    }
}

// ============================================
// CHAIN MANAGEMENT
// ============================================

async function fetchChains() {
    try {
        const response = await fetch('/api/chains');
        chains = await response.json();
        populateChainGrid();
        console.log('[Dust.zip] Loaded ' + Object.keys(chains).length + ' chains');
    } catch (error) {
        console.error('[Dust.zip] Failed to fetch chains:', error);
    }
}

function populateChainGrid() {
    const grid = document.getElementById('chainGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    for (const [key, chain] of Object.entries(chains)) {
        selectedChains.add(key);
        
        const item = document.createElement('div');
        item.className = 'chain-item selected';
        item.dataset.chain = key;
        item.innerHTML = `
            <div class="chain-checkbox">✓</div>
            <div class="chain-color" style="background:${chain.color}"></div>
            <span class="chain-name">${chain.name}</span>
        `;
        item.onclick = () => toggleChain(key, item);
        grid.appendChild(item);
    }
}

function toggleChain(key, item) {
    if (selectedChains.has(key)) {
        selectedChains.delete(key);
        item.classList.remove('selected');
    } else {
        selectedChains.add(key);
        item.classList.add('selected');
    }
}

function selectAllChains() {
    document.querySelectorAll('.chain-item').forEach(item => {
        selectedChains.add(item.dataset.chain);
        item.classList.add('selected');
    });
}

function deselectAllChains() {
    document.querySelectorAll('.chain-item').forEach(item => {
        selectedChains.delete(item.dataset.chain);
        item.classList.remove('selected');
    });
}

// ============================================
// PRICE & FORMATTING
// ============================================

async function fetchEthPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        ethPrice = data.ethereum?.usd || 2500;
    } catch (e) {
        ethPrice = 2500;
    }
}

function formatEth(value) {
    return (parseFloat(value) || 0).toFixed(6);
}

function formatUsd(ethValue) {
    const usd = (parseFloat(ethValue) || 0) * ethPrice;
    return '$' + usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortenAddress(addr) {
    return addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : '';
}

function showStatus(message, type) {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = message;
    el.className = 'status ' + type;
    el.classList.remove('hidden');
    if (type === 'success') {
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}

// ============================================
// BALANCE SCANNING
// ============================================

async function scanBalances() {
    const address = document.getElementById('walletAddress').value.trim();
    
    if (!address || !address.startsWith('0x') || address.length !== 42) {
        showStatus('Please enter a valid wallet address', 'error');
        return;
    }
    
    if (selectedChains.size === 0) {
        showStatus('Please select at least one chain', 'error');
        return;
    }
    
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const scanBtn = document.getElementById('scanBtn');
    
    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    scanBtn.disabled = true;
    document.getElementById('loadingText').textContent = `Scanning ${selectedChains.size} chains...`;
    
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
        
        if (data.error) throw new Error(data.error);
        
        balances = data.balances || [];
        displayResults(data);
        
    } catch (error) {
        console.error('[Dust.zip] Scan error:', error);
        showStatus('Scan failed: ' + error.message, 'error');
    } finally {
        loadingDiv.classList.add('hidden');
        scanBtn.disabled = false;
    }
}

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
    
    const withBalance = balances.filter(b => parseFloat(b.balance) > 0);
    
    if (withBalance.length === 0) {
        balanceList.innerHTML = '<p class="no-dust">No dust found on selected chains</p>';
    } else {
        withBalance.forEach(b => {
            const bal = parseFloat(b.balance) || 0;
            const item = document.createElement('div');
            item.className = 'balance-item';
            item.innerHTML = `
                <div class="balance-chain">
                    <div class="chain-dot" style="background:${b.color || '#666'}"></div>
                    <span>${b.chain}</span>
                </div>
                <div class="balance-values">
                    <div class="balance-eth">${formatEth(bal)} ${b.symbol || 'ETH'}</div>
                    <div class="balance-usd">${formatUsd(bal)}</div>
                </div>
            `;
            balanceList.appendChild(item);
        });
    }
    
    document.getElementById('results').classList.remove('hidden');
}

// ============================================
// DUST AGGREGATION (CROSS-CHAIN BRIDGING)
// ============================================

async function aggregateDust() {
    const destination = document.getElementById('destinationAddress').value.trim();
    const destChain = document.getElementById('destinationChain').value;
    
    if (!destination || !destination.startsWith('0x') || destination.length !== 42) {
        showStatus('Please enter a valid destination address', 'error');
        return;
    }
    
    // Filter chains with meaningful balance (> 0.001 ETH)
    const chainsWithBalance = balances.filter(b => parseFloat(b.balance) > 0.001);
    
    if (chainsWithBalance.length === 0) {
        showStatus('No dust to aggregate (minimum 0.001 ETH per chain)', 'error');
        return;
    }
    
    if (!signer) {
        showStatus('Please connect your wallet first', 'error');
        return;
    }
    
    const aggregateBtn = document.getElementById('aggregateBtn');
    aggregateBtn.disabled = true;
    
    showStatus('⏳ Preparing cross-chain transactions...', 'info');
    
    try {
        // Get aggregation plan from backend
        const response = await fetch('/api/aggregate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: connectedAddress,
                destination: destination,
                destination_chain: destChain,
                balances: chainsWithBalance
            })
        });
        
        const data = await response.json();
        
        if (data.error) throw new Error(data.error);
        
        console.log('[Dust.zip] Aggregation plan:', data);
        
        const transactions = data.transactions || [];
        
        if (transactions.length === 0) {
            showStatus('No transactions to execute', 'error');
            return;
        }
        
        // Group transactions by chain
        const txByChain = {};
        transactions.forEach(tx => {
            const key = tx.chain_key || tx.chain;
            if (!txByChain[key]) txByChain[key] = [];
            txByChain[key].push(tx);
        });
        
        let successCount = 0;
        let totalTx = transactions.filter(t => t.type !== 'hold' && t.type !== 'error').length;
        
        // Execute transactions chain by chain
        for (const [chainKey, txs] of Object.entries(txByChain)) {
            const chainData = chains[chainKey];
            if (!chainData) continue;
            
            // Switch to the correct network
            const switched = await switchNetwork(chainData.chain_id, chainData.name);
            if (!switched) {
                showStatus(`⚠️ Could not switch to ${chainData.name}, skipping...`, 'error');
                continue;
            }
            
            // Refresh provider after network switch
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            
            // Execute each transaction on this chain
            for (const tx of txs) {
                if (tx.type === 'hold' || tx.type === 'error') {
                    console.log(`[Dust.zip] Skipping ${tx.type} tx:`, tx.description);
                    continue;
                }
                
                try {
                    showStatus(`⏳ ${tx.description || tx.type}...`, 'info');
                    
                    const txParams = {
                        to: tx.to,
                        value: ethers.toBigInt(tx.value || '0'),
                        data: tx.data || '0x'
                    };
                    
                    if (tx.gasLimit) {
                        txParams.gasLimit = ethers.toBigInt(tx.gasLimit);
                    }
                    
                    console.log('[Dust.zip] Sending tx:', txParams);
                    
                    const txResponse = await signer.sendTransaction(txParams);
                    showStatus(`⏳ Confirming ${tx.type} on ${tx.chain}...`, 'info');
                    
                    await txResponse.wait();
                    successCount++;
                    
                    console.log('[Dust.zip] TX confirmed:', txResponse.hash);
                    
                } catch (txError) {
                    console.error('[Dust.zip] TX error:', txError);
                    showStatus(`⚠️ ${tx.type} failed: ${txError.message.slice(0, 50)}`, 'error');
                }
            }
        }
        
        // Final status
        if (successCount === totalTx) {
            showStatus(`✅ Complete! ${successCount} transactions sent successfully.`, 'success');
        } else {
            showStatus(`⚠️ Completed with ${successCount}/${totalTx} transactions.`, 'info');
        }
        
        // Show bridge info
        if (data.instructions) {
            console.log('[Dust.zip] Instructions:', data.instructions);
        }
        
    } catch (error) {
        console.error('[Dust.zip] Aggregation error:', error);
        showStatus('Aggregation failed: ' + error.message, 'error');
    } finally {
        aggregateBtn.disabled = false;
    }
}

// ============================================
// NETWORK SWITCHING
// ============================================

async function switchNetwork(chainId, chainName) {
    const chainIdHex = '0x' + chainId.toString(16);
    
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }]
        });
        showStatus(`✓ Switched to ${chainName}`, 'info');
        return true;
        
    } catch (switchError) {
        // Chain not added to wallet
        if (switchError.code === 4902) {
            showStatus(`Please add ${chainName} to MetaMask`, 'error');
            return false;
        }
        
        // User rejected
        if (switchError.code === 4001) {
            showStatus(`Network switch rejected`, 'error');
            return false;
        }
        
        console.error('[Dust.zip] Switch error:', switchError);
        return false;
    }
}
