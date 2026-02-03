// Dust.zip EIP-7702 Dust Aggregator - Stargate/LayerZero Implementation

let provider = null;
let signer = null;
let userAddress = null;
let ethPrice = 2500;
let selectedChains = new Set();

// Chain selection
const chainKeys = Object.keys(CHAINS);

// Initialize on page load
(function init() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();

function initApp() {
    console.log('✅ [Dust.zip] Initializing...');
    
    loadEthersJS();
    populateChains();
    setupEventListeners();
    fetchETHPrice();
}

function loadEthersJS() {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/ethers@6.9.0/dist/ethers.umd.min.js';
    script.onload = () => {
        console.log('✅ [Dust.zip] Ethers.js loaded');
        checkExistingConnection();
    };
    script.onerror = () => {
        console.error('❌ [Dust.zip] Failed to load Ethers.js from unpkg');
        // Try fallback
        const fallback = document.createElement('script');
        fallback.src = 'https://cdn.jsdelivr.net/npm/ethers@6.9.0/dist/ethers.umd.min.js';
        fallback.onload = () => {
            console.log('✅ [Dust.zip] Ethers.js loaded from jsdelivr');
            checkExistingConnection();
        };
        document.head.appendChild(fallback);
    };
    document.head.appendChild(script);
}

function populateChains() {
    const grid = document.getElementById('chainGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    chainKeys.forEach(key => {
        const chain = CHAINS[key];
        const div = document.createElement('div');
        div.className = 'chain-item';
        div.innerHTML = `
            <label class="chain-label">
                <input type="checkbox" class="chain-checkbox" value="${key}" data-color="${chain.color}">
                <div class="chain-name" style="border-left: 3px solid ${chain.color}">${chain.name}</div>
                <div class="chain-symbol">${chain.symbol}</div>
            </label>
        `;
        grid.appendChild(div);
        
        // Add to selected set by default
        selectedChains.add(key);
    });
    
    // Setup checkbox listeners
    document.querySelectorAll('.chain-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedChains.add(e.target.value);
            } else {
                selectedChains.delete(e.target.value);
            }
        });
        checkbox.checked = true;
    });
}

function setupEventListeners() {
    const connectBtn = document.getElementById('connectWalletBtn');
    if (connectBtn) {
        connectBtn.onclick = connectWallet;
    }
    
    const scanBtn = document.getElementById('scanBtn');
    if (scanBtn) {
        scanBtn.onclick = scanBalances;
    }
    
    const bridgeBtn = document.getElementById('bridgeBtn');
    if (bridgeBtn) {
        bridgeBtn.onclick = executeBridge;
    }
    
    // Manual address input
    const addressInput = document.getElementById('manualAddress');
    if (addressInput) {
        addressInput.addEventListener('input', (e) => {
            if (e.target.value.length === 42 && e.target.value.startsWith('0x')) {
                userAddress = e.target.value;
                updateWalletUI(userAddress);
            }
        });
    }
    
    // Select all / deselect all
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    
    if (selectAllBtn) {
        selectAllBtn.onclick = () => {
            document.querySelectorAll('.chain-checkbox').forEach(cb => {
                cb.checked = true;
                selectedChains.add(cb.value);
            });
        };
    }
    
    if (deselectAllBtn) {
        deselectAllBtn.onclick = () => {
            document.querySelectorAll('.chain-checkbox').forEach(cb => {
                cb.checked = false;
                selectedChains.delete(cb.value);
            });
        };
    }
}

async function checkExistingConnection() {
    if (typeof ethers === 'undefined') {
        setTimeout(checkExistingConnection, 500);
        return;
    }
    
    try {
        if (window.ethereum) {
            provider = new ethers.BrowserProvider(window.ethereum);
            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                signer = await provider.getSigner();
                userAddress = await signer.getAddress();
                updateWalletUI(userAddress);
                console.log('✅ [Dust.zip] Already connected:', userAddress);
            }
        }
    } catch (error) {
        console.error('❌ [Dust.zip] Connection check failed:', error);
    }
}

async function connectWallet() {
    console.log('🔌 [Dust.zip] Connecting wallet...');
    
    if (typeof ethers === 'undefined') {
        alert('Ethers.js not loaded yet. Please wait a moment.');
        return;
    }
    
    try {
        if (!window.ethereum) {
            alert('Please install MetaMask or another Web3 wallet!');
            window.open('https://metamask.io/download/', '_blank');
            return;
        }
        
        provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send('eth_requestAccounts', []);
        
        if (accounts.length === 0) {
            alert('Please connect at least one account');
            return;
        }
        
        signer = await provider.getSigner();
        userAddress = await signer.getAddress();
        
        updateWalletUI(userAddress);
        console.log('✅ [Dust.zip] Connected:', userAddress);
        
        // Auto-scan after connecting
        await scanBalances();
        
    } catch (error) {
        console.error('❌ [Dust.zip] Connection failed:', error);
        alert('Failed to connect wallet: ' + error.message);
    }
}

function updateWalletUI(address) {
    const shortAddr = address.slice(0, 6) + '...' + address.slice(-4);
    const btn = document.getElementById('connectWalletBtn');
    if (btn) {
        btn.textContent = shortAddr;
        btn.classList.add('connected');
    }
    document.getElementById('manualAddress').value = address;
    document.getElementById('resultAddress').textContent = shortAddr;
}

async function fetchETHPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,matic-network,avalanche-2,fantom,ethereum,moonbeam,celo,xdai,ethereum,ethereum,ethereum,ethereum&vs_currencies=usd');
        const data = await response.json();
        ethPrice = data.ethereum?.usd || 2500;
    } catch (error) {
        console.warn('⚠️ [Dust.zip] Using fallback ETH price');
    }
}

async function scanBalances() {
    console.log('🔍 [Dust.zip] Scanning balances...');
    
    if (!userAddress) {
        alert('Please connect wallet first!');
        return;
    }
    
    const btn = document.getElementById('scanBtn');
    if (btn) btn.disabled = true;
    
    try {
        const response = await fetch('/api/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                address: userAddress,
                chains: Array.from(selectedChains)
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Scan failed');
        }
        
        const data = await response.json();
        console.log('✅ [Dust.zip] Scan complete:', data);
        
        displayResults(data);
        
    } catch (error) {
        console.error('❌ [Dust.zip] Scan failed:', error);
        alert('Failed to scan balances: ' + error.message);
    } finally {
        if (btn) btn.disabled = false;
    }
}

function displayResults(data) {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    
    container.classList.remove('hidden');
    
    // Display total
    document.getElementById('totalETH').textContent = data.total.toFixed(4);
    document.getElementById('totalUSD').textContent = '$' + (data.total * ethPrice).toFixed(2);
    document.getElementById('feeETH').textContent = data.fee.toFixed(4);
    document.getElementById('feeUSD').textContent = '$' + (data.fee * ethPrice).toFixed(2);
    document.getElementById('netETH').textContent = data.net.toFixed(4);
    document.getElementById('netUSD').textContent = '$' + (data.net * ethPrice).toFixed(2);
    
    // Display balances
    const balancesDiv = document.getElementById('balancesList');
    if (balancesDiv) {
        const withBalance = data.balances.filter(b => b.balance > 0.001);
        
        if (withBalance.length === 0) {
            balancesDiv.innerHTML = '<p class="no-balance">No significant balances found</p>';
            return;
        }
        
        balancesDiv.innerHTML = withBalance.map(b => `
            <div class="balance-item" style="border-left: 4px solid ${b.color}">
                <div class="balance-chain">${b.name}</div>
                <div class="balance-amount">
                    <span class="eth-value">${b.balance.toFixed(4)} ${b.symbol}</span>
                    <span class="usd-value">≈ $${(b.balance * ethPrice).toFixed(2)}</span>
                </div>
            </div>
        `).join('');
    }
    
    // Store balances for bridge
    window.currentBalances = data.balances.filter(b => b.balance > 0.001);
    window.scanData = data;
}

async function executeBridge() {
    console.log('🌉 [Dust.zip] Preparing bridge...');
    
    if (!userAddress) {
        alert('Please connect wallet first!');
        return;
    }
    
    if (!window.currentBalances || window.currentBalances.length === 0) {
        alert('No balances to bridge. Please scan first!');
        return;
    }
    
    const destChainKey = document.getElementById('destChain')?.value || 'ethereum';
    console.log('🌉 [Dust.zip] Destination chain:', destChainKey);
    
    try {
        // Prepare bridge transactions
        const response = await fetch('/api/prepare-bridge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from_address: userAddress,
                to_address: userAddress,
                destination_chain: destChainKey,
                balances: window.currentBalances
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Bridge preparation failed');
        }
        
        const data = await response.json();
        console.log('✅ [Dust.zip] Bridge prepared:', data);
        
        if (data.transactions.length === 0) {
            alert('No transactions to execute. Balances too low.');
            return;
        }
        
        console.log(`🌉 [Dust.zip] Executing ${data.transactions.length} transactions...`);
        
        // Execute transactions sequentially
        for (let i = 0; i < data.transactions.length; i++) {
            const tx = data.transactions[i];
            console.log(`🌉 [Dust.zip] Processing tx ${i+1}/${data.transactions.length}:`, tx);
            
            try {
                await executeTransaction(tx, i, data.transactions.length);
            } catch (error) {
                console.error(`❌ [Dust.zip] Transaction ${i+1} failed:`, error);
                alert(`Transaction ${i+1} failed: ${error.message}`);
                return;
            }
        }
        
        console.log('✅ [Dust.zip] All transactions complete!');
        alert(`Bridge complete! ${data.transactions.length} transactions executed.\nTokens will arrive in 5-15 minutes.`);
        
    } catch (error) {
        console.error('❌ [Dust.zip] Bridge failed:', error);
        alert('Bridge failed: ' + error.message);
    }
}

async function executeTransaction(tx, index, total) {
    console.log(`🌉 [Dust.zip] Executing tx ${index + 1}/${total}: ${tx.type} on ${tx.chain_name}`);
    
    // Switch network
    await switchNetwork(tx.chain_id, tx.chain_name);
    
    // Create transaction
    const txRequest = {
        to: tx.to,
        value: tx.value,
        data: tx.data || '0x',
        gasLimit: tx.gas_limit || '300000'
    };
    
    console.log(`🌉 [Dust.zip] Sending transaction...`);
    const transaction = await signer.sendTransaction(txRequest);
    console.log(`✅ [Dust.zip] Transaction sent: ${transaction.hash}`);
    
    // Wait for confirmation
    console.log(`⏳ [Dust.zip] Waiting for confirmation...`);
    const receipt = await transaction.wait();
    console.log(`✅ [Dust.zip] Transaction confirmed in block ${receipt.blockNumber}`);
    
    return receipt;
}

async function switchNetwork(chainId, chainName) {
    const hexChainId = '0x' + chainId.toString(16);
    
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexChainId }]
        });
        console.log(`✅ [Dust.zip] Network switched to ${chainName}`);
    } catch (switchError) {
        if (switchError.code === 4902) {
            // Chain not added, add it
            const chain = Object.values(CHAINS).find(c => c.chain_id === chainId);
            if (chain) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: hexChainId,
                            chainName: chain.name,
                            nativeCurrency: {
                                name: chain.symbol,
                                symbol: chain.symbol,
                                decimals: 18
                            },
                            rpcUrls: [chain.rpc],
                            blockExplorerUrls: [`https://etherscan.io`] // Simplified
                        }]
                    });
                } catch (addError) {
                    throw new Error(`Failed to add ${chainName}: ${addError.message}`);
                }
            }
        } else {
            throw new Error(`Failed to switch to ${chainName}: ${switchError.message}`);
        }
    }
}

// Load chains configuration
const CHAINS = {
    "ethereum": {
        "name": "Ethereum",
        "rpc": "https://eth.llamarpc.com",
        "chain_id": 1,
        "symbol": "ETH",
        "color": "#627EEA"
    },
    "polygon": {
        "name": "Polygon",
        "rpc": "https://polygon-rpc.com",
        "chain_id": 137,
        "symbol": "MATIC",
        "color": "#8247E5"
    },
    "bsc": {
        "name": "BNB Chain",
        "rpc": "https://bsc-dataseed.binance.org",
        "chain_id": 56,
        "symbol": "BNB",
        "color": "#F3BA2F"
    },
    "arbitrum": {
        "name": "Arbitrum",
        "rpc": "https://arb1.arbitrum.io/rpc",
        "chain_id": 42161,
        "symbol": "ETH",
        "color": "#28A0F0"
    },
    "optimism": {
        "name": "Optimism",
        "rpc": "https://mainnet.optimism.io",
        "chain_id": 10,
        "symbol": "ETH",
        "color": "#FF0420"
    },
    "avalanche": {
        "name": "Avalanche",
        "rpc": "https://api.avax.network/ext/bc/C/rpc",
        "chain_id": 43114,
        "symbol": "AVAX",
        "color": "#E84142"
    },
    "fantom": {
        "name": "Fantom",
        "rpc": "https://rpc.ftm.tools",
        "chain_id": 250,
        "symbol": "FTM",
        "color": "#1969FF"
    },
    "base": {
        "name": "Base",
        "rpc": "https://mainnet.base.org",
        "chain_id": 8453,
        "symbol": "ETH",
        "color": "#0052FF"
    },
    "linea": {
        "name": "Linea",
        "rpc": "https://rpc.linea.build",
        "chain_id": 59144,
        "symbol": "ETH",
        "color": "#61DFFF"
    },
    "scroll": {
        "name": "Scroll",
        "rpc": "https://rpc.scroll.io",
        "chain_id": 534352,
        "symbol": "ETH",
        "color": "#FFDBB0"
    },
    "zksync": {
        "name": "zkSync Era",
        "rpc": "https://mainnet.era.zksync.io",
        "chain_id": 324,
        "symbol": "ETH",
        "color": "#8C8DFC"
    },
    "moonbeam": {
        "name": "Moonbeam",
        "rpc": "https://rpc.api.moonbeam.network",
        "chain_id": 1284,
        "symbol": "GLMR",
        "color": "#53CBC8"
    },
    "celo": {
        "name": "Celo",
        "rpc": "https://forno.celo.org",
        "chain_id": 42220,
        "symbol": "CELO",
        "color": "#FCFF52"
    },
    "gnosis": {
        "name": "Gnosis",
        "rpc": "https://rpc.gnosischain.com",
        "chain_id": 100,
        "symbol": "xDAI",
        "color": "#04795B"
    },
    "aurora": {
        "name": "Aurora",
        "rpc": "https://mainnet.aurora.dev",
        "chain_id": 1313161554,
        "symbol": "ETH",
        "color": "#70D44B"
    }
};

console.log('✅ [Dust.zip] App.js loaded');
