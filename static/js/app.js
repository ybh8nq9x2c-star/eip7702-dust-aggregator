// State
let chains = [];
let selectedChains = new Set();
let userAddress = '';
let balances = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing Dust.zip');
    
    // Load chains
    await loadChains();
    
    // Check if wallet already connected
    if (window.ethereum && window.ethereum.selectedAddress) {
        await connectWallet();
    }
});

// Load chains
async function loadChains() {
    try {
        const response = await fetch('/api/chains');
        chains = await response.json();
        console.log('✅ Chains loaded:', Object.keys(chains).length);
        renderChains();
    } catch (error) {
        console.error('❌ Failed to load chains:', error);
        showStatus('error', 'Failed to load chains');
    }
}

// Render chains
function renderChains() {
    const grid = document.getElementById('chainGrid');
    grid.innerHTML = '';
    
    Object.keys(chains).forEach(chainKey => {
        const chain = chains[chainKey];
        const card = document.createElement('div');
        card.className = 'chain-card';
        card.innerHTML = `
            <input type="checkbox" id="chain-${chainKey}" value="${chainKey}">
            <label for="chain-${chainKey}">${chain.name}</label>
        `;
        
        card.addEventListener('click', (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = card.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            if (card.querySelector('input').checked) {
                card.classList.add('selected');
                selectedChains.add(chainKey);
            } else {
                card.classList.remove('selected');
                selectedChains.delete(chainKey);
            }
            console.log('📊 Selected chains:', Array.from(selectedChains));
        });
        
        grid.appendChild(card);
    });
}

// Select/Deselect all
function selectAllChains() {
    document.querySelectorAll('.chain-card input').forEach(checkbox => {
        checkbox.checked = true;
        checkbox.parentElement.classList.add('selected');
        selectedChains.add(checkbox.value);
    });
    console.log('✅ All chains selected');
}

function deselectAllChains() {
    document.querySelectorAll('.chain-card input').forEach(checkbox => {
        checkbox.checked = false;
        checkbox.parentElement.classList.remove('selected');
        selectedChains.delete(checkbox.value);
    });
    console.log('✅ All chains deselected');
}

// Connect wallet
document.getElementById('connectBtn').addEventListener('click', connectWallet);

async function connectWallet() {
    if (!window.ethereum) {
        showStatus('error', 'Please install MetaMask');
        return;
    }
    
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        userAddress = await signer.getAddress();
        
        document.getElementById('connectBtn').textContent = 'Wallet Connected';
        document.getElementById('connectBtn').disabled = true;
        
        const walletInfo = document.getElementById('walletInfo');
        walletInfo.innerHTML = `<p>✅ Connected: ${userAddress}</p>`;
        walletInfo.classList.remove('hidden');
        
        console.log('✅ Wallet connected:', userAddress);
        showStatus('success', 'Wallet connected!');
    } catch (error) {
        console.error('❌ Failed to connect wallet:', error);
        showStatus('error', 'Failed to connect wallet: ' + error.message);
    }
}

// Scan balances
async function scanBalances() {
    if (!userAddress) {
        showStatus('error', 'Please connect wallet first');
        return;
    }
    
    if (selectedChains.size === 0) {
        showStatus('error', 'Please select at least one chain');
        return;
    }
    
    showStatus('loading', 'Scanning balances across ' + selectedChains.size + ' chains...');
    
    try {
        const response = await fetch('/api/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: userAddress,
                chains: Array.from(selectedChains)
            })
        });
        
        const data = await response.json();
        balances = data.balances || [];
        
        console.log('✅ Balances found:', balances.length);
        
        if (balances.length === 0) {
            showStatus('error', 'No balances found on selected chains');
            return;
        }
        
        displayBalances();
        showStatus('success', 'Found ' + balances.length + ' chains with balances!');
    } catch (error) {
        console.error('❌ Failed to scan balances:', error);
        showStatus('error', 'Failed to scan: ' + error.message);
    }
}

// Display balances
function displayBalances() {
    const results = document.getElementById('scanResults');
    results.innerHTML = '<h3>📊 Balances Found</h3>';
    
    balances.forEach(bal => {
        const item = document.createElement('div');
        item.className = 'balance-item';
        item.innerHTML = `
            <h3>${bal.name}</h3>
            <div class="balance-amount">${bal.balance.toFixed(6)} ${bal.symbol}</div>
        `;
        results.appendChild(item);
    });
    
    results.classList.remove('hidden');
}

// Execute transactions
async function executeTransactions() {
    if (!userAddress) {
        showStatus('error', 'Please connect wallet first');
        return;
    }
    
    if (balances.length === 0) {
        showStatus('error', 'Please scan balances first');
        return;
    }
    
    const destAddress = document.getElementById('destAddress').value;
    if (!destAddress) {
        showStatus('error', 'Please enter destination address');
        return;
    }
    
    showStatus('loading', 'Preparing transactions...');
    
    try {
        const response = await fetch('/api/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: userAddress,
                to_address: destAddress,
                chains: balances.map(b => b.chain)
            })
        });
        
        const data = await response.json();
        const transactions = data.transactions || [];
        
        if (transactions.length === 0) {
            showStatus('error', 'No transactions to execute');
            return;
        }
        
        showStatus('loading', 'Executing ' + transactions.length + ' transactions...');
        
        const results = document.getElementById('results');
        results.innerHTML = '<h3>🚀 Execution Results</h3>';
        
        let successCount = 0;
        let failCount = 0;
        
        for (const tx of transactions) {
            try {
                // Execute fee transaction
                const feeHash = await executeTransaction(tx.fee_tx, tx.name);
                if (feeHash) {
                    successCount++;
                } else {
                    failCount++;
                }
                
                // Execute user transaction
                const userHash = await executeTransaction(tx.user_tx, tx.name);
                if (userHash) {
                    successCount++;
                } else {
                    failCount++;
                }
                
                // Display result
                const item = document.createElement('div');
                item.className = 'tx-item';
                item.innerHTML = `
                    <h4>${tx.name}</h4>
                    <p>Fee: ${tx.fee_amount.toFixed(6)} ETH</p>
                    <p>Received: ${tx.user_amount.toFixed(6)} ETH</p>
                    <div class="tx-link">
                        <a href="${tx.explorer}${feeHash}" target="_blank">View Fee Tx</a>
                        <br>
                        <a href="${tx.explorer}${userHash}" target="_blank">View User Tx</a>
                    </div>
                `;
                results.appendChild(item);
                
            } catch (error) {
                console.error('❌ Failed to execute on', tx.name, error);
                failCount++;
            }
        }
        
        results.classList.remove('hidden');
        
        if (failCount > 0) {
            showStatus('error', `Completed: ${successCount} success, ${failCount} failed`);
        } else {
            showStatus('success', '✅ All transactions completed successfully!');
        }
        
    } catch (error) {
        console.error('❌ Failed to execute:', error);
        showStatus('error', 'Execution failed: ' + error.message);
    }
}

// Execute single transaction
async function executeTransaction(txData, chainName) {
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Switch network if needed
        const chainId = parseInt(txData.chainId, 16);
        try {
            await provider.send('wallet_switchEthereumChain', [{ chainId: chainId }]);
        } catch (switchError) {
            if (switchError.code === 4902) {
                // Chain not added, add it
                const chain = Object.values(chains).find(c => c.chain_id === chainId);
                if (chain) {
                    await provider.send('wallet_addEthereumChain', [{
                        chainId: '0x' + chainId.toString(16),
                        chainName: chain.name,
                        nativeCurrency: { name: chain.symbol, symbol: chain.symbol, decimals: 18 },
                        rpcUrls: [chain.rpc],
                        blockExplorerUrls: [chain.explorer]
                    }]);
                }
            } else {
                throw switchError;
            }
        }
        
        // Sign and send transaction
        const signer = provider.getSigner();
        const tx = await signer.sendTransaction(txData);
        console.log(`✅ ${chainName}: TX sent`, tx.hash);
        
        // Wait for confirmation
        await tx.wait();
        console.log(`✅ ${chainName}: TX confirmed`, tx.hash);
        
        return tx.hash;
    } catch (error) {
        console.error(`❌ ${chainName}: Failed`, error);
        return null;
    }
}

// Show status
function showStatus(type, message) {
    const status = document.getElementById('status');
    status.className = 'status ' + type;
    status.innerHTML = message;
    console.log(`📢 Status [${type}]:`, message);
}
