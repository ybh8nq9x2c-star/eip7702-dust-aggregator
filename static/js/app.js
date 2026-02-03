// =============================================
// DUST.ZIP - Cross-Chain Dust Aggregator
// With LI.FI Bridge Integration
// =============================================

let provider = null;
let signer = null;
let userAddress = null;
let chains = {};
let selectedChains = new Set();
let scannedBalances = [];
let prices = {};

console.log('[Dust.zip] Script loaded');

// Token prices from CoinGecko
const TOKEN_IDS = {
    'ethereum': 'ethereum',
    'polygon': 'matic-network',
    'bsc': 'binancecoin',
    'arbitrum': 'ethereum',
    'optimism': 'ethereum',
    'avalanche': 'avalanche-2',
    'fantom': 'fantom',
    'base': 'ethereum',
    'linea': 'ethereum',
    'scroll': 'ethereum',
    'zksync': 'ethereum',
    'moonbeam': 'moonbeam',
    'celo': 'celo',
    'gnosis': 'gnosis',
    'aurora': 'ethereum'
};

function init() {
    console.log('[Dust.zip] Initializing...');
    fetchAllPrices();
    fetchChains();
    
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// =============================================
// PRICE FETCHING
// =============================================

async function fetchAllPrices() {
    console.log('[Dust.zip] Fetching all token prices...');
    
    try {
        // Get unique token IDs
        const uniqueIds = [...new Set(Object.values(TOKEN_IDS))];
        const ids = uniqueIds.join(',');
        
        // Fetch all prices in one call
        const res = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
        );
        
        if (!res.ok) throw new Error('CoinGecko API failed');
        
        const data = await res.json();
        
        // Build price map for each chain
        Object.keys(TOKEN_IDS).forEach(key => {
            const tokenId = TOKEN_IDS[key];
            const price = data[tokenId]?.usd || 0;
            prices[key] = price;
        });
        
        console.log('[Dust.zip] Prices loaded:', prices);
        
    } catch (err) {
        console.error('[Dust.zip] Price fetch error:', err);
        // Fallback prices
        prices = {
            'ethereum': 2500,
            'polygon': 0.7,
            'bsc': 350,
            'arbitrum': 2500,
            'optimism': 2500,
            'avalanche': 35,
            'fantom': 0.5,
            'base': 2500,
            'linea': 2500,
            'scroll': 2500,
            'zksync': 2500,
            'moonbeam': 0.2,
            'celo': 0.8,
            'gnosis': 1,
            'aurora': 2500
        };
    }
}

function getChainPrice(chainKey) {
    return prices[chainKey] || 0;
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
        
        if (typeof ethers === 'undefined') {
            throw new Error('Ethers.js not loaded');
        }
        
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        userAddress = accounts[0];
        signer = await provider.getSigner();
        
        const connectText = document.getElementById('connectText');
        const connectBtn = document.getElementById('connectBtn');
        const addressInput = document.getElementById('addressInput');
        const destAddressInput = document.getElementById('destAddressInput');
        
        if (connectText) connectText.textContent = shortAddr(userAddress);
        if (connectBtn) connectBtn.classList.add('connected');
        if (addressInput) addressInput.value = userAddress;
        if (destAddressInput && !destAddressInput.value) destAddressInput.value = userAddress;
        
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
    try {
        const res = await fetch('/api/chains');
        if (!res.ok) throw new Error('Failed to fetch chains');
        
        chains = await res.json();
        console.log('[Dust.zip] Chains loaded:', Object.keys(chains).length);
        renderChainGrid();
        renderDestinationSelect();
        
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
}

function renderDestinationSelect() {
    const select = document.getElementById('destChainSelect');
    if (!select) return;
    
    select.innerHTML = '';
    
    Object.entries(chains).forEach(([key, chain]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = chain.name;
        if (key === 'ethereum') option.selected = true;
        select.appendChild(option);
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
// BALANCE SCANNING
// =============================================

async function scanBalances() {
    console.log('[Dust.zip] Scanning balances...');
    
    const addressInput = document.getElementById('addressInput');
    const address = addressInput ? addressInput.value.trim() : '';
    
    if (!address || address.length !== 42 || !address.startsWith('0x')) {
        showStatus('Please enter a valid address', 'error');
        return;
    }
    
    if (selectedChains.size === 0) {
        showStatus('Please select at least one chain', 'error');
        return;
    }
    
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const scanBtn = document.getElementById('scanBtn');
    const loadingText = document.getElementById('loadingText');
    
    if (loading) loading.classList.remove('hidden');
    if (results) results.classList.add('hidden');
    if (scanBtn) scanBtn.disabled = true;
    if (loadingText) loadingText.textContent = `Scanning ${selectedChains.size} chains...`;
    
    try {
        await fetchAllPrices();
        
        const res = await fetch('/api/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: address,
                chains: Array.from(selectedChains)
            })
        });
        
        if (!res.ok) throw new Error('API request failed: ' + res.status);
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        scannedBalances = Array.isArray(data.balances) ? data.balances : [];
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
    const total = parseFloat(data.total) || 0;
    const fee = parseFloat(data.fee) || 0;
    const net = parseFloat(data.net) || 0;
    
    // Calculate total USD by summing individual chain USD values
    let totalUsd = 0;
    scannedBalances.forEach(b => {
        const bal = parseFloat(b.balance) || 0;
        const chainKey = b.key || '';
        const price = getChainPrice(chainKey);
        totalUsd += bal * price;
    });
    
    const feeUsd = totalUsd * 0.05;
    const netUsd = totalUsd - feeUsd;
    
    const totalValue = document.getElementById('totalValue');
    const totalUsdEl = document.getElementById('totalUsd');
    const feeValue = document.getElementById('feeValue');
    const netValue = document.getElementById('netValue');
    
    if (totalValue) totalValue.textContent = total.toFixed(6) + ' tokens';
    if (totalUsdEl) totalUsdEl.textContent = '$' + totalUsd.toFixed(2);
    if (feeValue) feeValue.textContent = (total * 0.05).toFixed(6) + ' tokens ($' + feeUsd.toFixed(2) + ')';
    if (netValue) netValue.textContent = net.toFixed(6) + ' tokens ($' + netUsd.toFixed(2) + ')';
    
    const list = document.getElementById('balanceList');
    if (list) {
        list.innerHTML = '';
        
        const withBalance = scannedBalances.filter(b => (parseFloat(b.balance) || 0) > 0);
        
        if (withBalance.length === 0) {
            list.innerHTML = '<div class="no-dust">No dust found on selected chains</div>';
        } else {
            withBalance.forEach(b => {
                const bal = parseFloat(b.balance) || 0;
                const chainKey = b.key || '';
                const price = getChainPrice(chainKey);
                const usdVal = bal * price;
                
                const div = document.createElement('div');
                div.className = 'balance-item';
                div.innerHTML = `
                    <div class="bal-chain">
                        <div class="chain-dot" style="background:${b.color || '#666'}"></div>
                        <span>${b.name || 'Unknown'}</span>
                    </div>
                    <div class="bal-values">
                        <div class="bal-eth">${bal.toFixed(6)} ${b.symbol || 'ETH'}</div>
                        <div class="bal-usd">$${usdVal.toFixed(2)}</div>
                    </div>
                `;
                list.appendChild(div);
            });
        }
    }
    
    const destAddressInput = document.getElementById('destAddressInput');
    if (destAddressInput && userAddress && !destAddressInput.value) {
        destAddressInput.value = userAddress;
    }
    
    const results = document.getElementById('results');
    if (results) results.classList.remove('hidden');
}

// =============================================
// CROSS-CHAIN BRIDGE AGGREGATION
// =============================================

async function aggregateDust() {
    console.log('[Dust.zip] Starting cross-chain aggregation...');
    
    const destAddressInput = document.getElementById('destAddressInput');
    const destChainSelect = document.getElementById('destChainSelect');
    
    const destAddress = destAddressInput ? destAddressInput.value.trim() : '';
    const destChain = destChainSelect ? destChainSelect.value : 'ethereum';
    
    if (!destAddress || destAddress.length !== 42 || !destAddress.startsWith('0x')) {
        showStatus('Please enter a valid destination address', 'error');
        return;
    }
    
    if (!signer) {
        showStatus('Please connect your wallet first', 'error');
        return;
    }
    
    const withBalance = scannedBalances.filter(b => (parseFloat(b.balance) || 0) > 0.002);
    
    if (withBalance.length === 0) {
        showStatus('No dust to aggregate (min 0.002)', 'error');
        return;
    }
    
    const aggregateBtn = document.getElementById('aggregateBtn');
    if (aggregateBtn) aggregateBtn.disabled = true;
    
    showStatus('Preparing bridge transactions...', 'info');
    
    try {
        // Get bridge transactions from backend
        const res = await fetch('/api/prepare-bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                balances: withBalance,
                from_address: userAddress,
                to_address: destAddress,
                destination_chain: destChain
            })
        });
        
        if (!res.ok) throw new Error('API request failed: ' + res.status);
        
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        const transactions = data.transactions || [];
        
        if (transactions.length === 0) {
            showStatus('No transactions to send', 'error');
            return;
        }
        
        // Show bridge quotes
        if (data.bridge_quotes && data.bridge_quotes.length > 0) {
            console.log('[Dust.zip] Bridge quotes:', data.bridge_quotes);
        }
        
        // Show progress UI
        const results = document.getElementById('results');
        const txProgress = document.getElementById('txProgress');
        const txList = document.getElementById('txList');
        
        if (results) results.classList.add('hidden');
        if (txProgress) txProgress.classList.remove('hidden');
        if (txList) txList.innerHTML = '';
        
        // Group by chain
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
            
            // Switch network
            const switched = await switchNetwork(chainData.chain_id, chainData.name);
            if (!switched) continue;
            
            // Refresh provider/signer
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            
            // Execute each tx
            for (const tx of txs) {
                const txDiv = document.createElement('div');
                txDiv.className = 'tx-item pending';
                
                const typeIcon = tx.type === 'fee' ? '💸' : (tx.type === 'bridge' ? '🌉' : '📤');
                const typeLabel = tx.type === 'fee' ? 'Fee' : (tx.type === 'bridge' ? `Bridge → ${tx.dest_chain}` : 'Transfer');
                
                txDiv.innerHTML = `
                    <span class="tx-chain">${tx.chain_name}</span>
                    <span class="tx-type">${typeIcon} ${typeLabel}</span>
                    <span class="tx-amount">${parseFloat(tx.value_eth).toFixed(6)}</span>
                    <span class="tx-status">⏳</span>
                `;
                if (txList) txList.appendChild(txDiv);
                
                try {
                    const txRequest = {
                        to: tx.to,
                        value: ethers.toBigInt(tx.value),
                        data: tx.data || '0x'
                    };
                    
                    // Add gas limit for bridge transactions
                    if (tx.gas_limit) {
                        txRequest.gasLimit = ethers.toBigInt(tx.gas_limit);
                    }
                    
                    const txResponse = await signer.sendTransaction(txRequest);
                    
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
            showStatus(`✅ Complete! ${successCount}/${totalCount} transactions`, 'success');
        } else if (successCount > 0) {
            showStatus(`⚠️ Partial: ${successCount}/${totalCount} transactions`, 'info');
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
    const el = document.getElementById('status');
    if (!el) return;
    
    el.textContent = msg;
    el.className = 'status ' + type;
    el.classList.remove('hidden');
    
    if (type === 'success' || type === 'info') {
        setTimeout(() => el.classList.add('hidden'), 5000);
    }
}
