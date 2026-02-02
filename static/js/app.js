// EIP-7702 Dust Aggregator - Gas.zip Style

class DustAggregator {
 constructor() {
 this.walletAddress = null;
 this.chains = [];
 this.balances = [];
 this.transactions = [];
 this.init();
 }

 init() {
 this.bindEvents();
 this.loadChains();
 }

 bindEvents() {
 document.getElementById('connectWallet').addEventListener('click', () => this.connectWallet());
 document.getElementById('disconnectWallet').addEventListener('click', () => this.disconnectWallet());
 document.getElementById('scanBalances').addEventListener('click', () => this.scanBalances());
 document.getElementById('aggregateDust').addEventListener('click', () => this.aggregateDust());
 document.getElementById('closeError').addEventListener('click', () => this.hideError());
 
 // Auto-fill target address when wallet is connected
 document.getElementById('walletAddressInput').addEventListener('input', (e) => {
 this.walletAddress = e.target.value;
 });
 }

 async loadChains() {
 try {
 const response = await fetch('/api/chains');
 const data = await response.json();
 this.chains = data.chains;
 } catch (error) {
 console.error('Error loading chains:', error);
 this.showError('Failed to load chains configuration');
 }
 }

 async connectWallet() {
 try {
 if (!window.ethereum) {
 this.showError('Please install MetaMask or another Web3 wallet');
 return;
 }

 const provider = new ethers.BrowserProvider(window.ethereum);
 const accounts = await provider.send('eth_requestAccounts', []);
 
 this.walletAddress = accounts[0];
 document.getElementById('walletAddressInput').value = this.walletAddress;
 this.updateWalletUI();
 } catch (error) {
 console.error('Error connecting wallet:', error);
 this.showError('Failed to connect wallet: ' + error.message);
 }
 }

 disconnectWallet() {
 this.walletAddress = null;
 this.balances = [];
 this.transactions = [];
 document.getElementById('walletAddressInput').value = '';
 this.hideWalletUI();
 }

 updateWalletUI() {
 const address = this.walletAddress.slice(0, 6) + '...' + this.walletAddress.slice(-4);
 document.getElementById('walletAddress').textContent = address;
 document.getElementById('walletBanner').classList.remove('hidden');
 document.getElementById('connectWallet').classList.add('hidden');
 }

 hideWalletUI() {
 document.getElementById('walletBanner').classList.add('hidden');
 document.getElementById('connectWallet').classList.remove('hidden');
 }

 async scanBalances() {
 // Get address from input field
 const addressInput = document.getElementById('walletAddressInput').value.trim();
 
 if (!addressInput) {
 this.showError('Please enter a wallet address or connect with MetaMask');
 return;
 }
 
 // Validate address format
 try {
 if (!ethers.isAddress(addressInput)) {
 this.showError('Invalid wallet address format');
 return;
 }
 } catch (error) {
 this.showError('Invalid wallet address format');
 return;
 }
 
 this.walletAddress = addressInput;
 this.showLoading('Scanning balances across all chains...');

 try {
 const response = await fetch('/api/balances', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({ address: this.walletAddress })
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Failed to scan balances');
 }

 const data = await response.json();
 this.balances = data.balances;
 
 this.updateBalancesUI(data);
 this.hideLoading();
 } catch (error) {
 console.error('Error scanning balances:', error);
 this.hideLoading();
 this.showError('Failed to scan balances: ' + error.message);
 }
 }

 updateBalancesUI(data) {
 // Update stats
 document.getElementById('chainsWithBalance').textContent = data.chains_with_balance;

 // Show balances section if there are balances
 if (this.balances.length > 0) {
 document.getElementById('balancesSection').classList.remove('hidden');
 document.getElementById('aggregateSection').classList.remove('hidden');
 
 // Render balances
 const balancesList = document.getElementById('balancesList');
 balancesList.innerHTML = '';

 this.balances.forEach(balance => {
 const card = document.createElement('div');
 card.className = 'balance-card';
 card.innerHTML = `
 <div class="balance-chain">
 <div class="chain-icon" style="background: ${balance.color}">
 ${balance.symbol[0]}
 </div>
 <div class="chain-name">${balance.chain}</div>
 </div>
 <div class="balance-amount">${balance.balance.toFixed(4)}</div>
 <div class="balance-symbol">${balance.symbol}</div>
 `;
 balancesList.appendChild(card);
 });

 // Calculate totals
 const total = this.balances.reduce((sum, b) => sum + b.balance, 0);
 const fee = total * 0.05;
 const youReceive = total - fee;

 document.getElementById('totalBalance').textContent = total.toFixed(4);
 document.getElementById('estimatedFee').textContent = fee.toFixed(4);
 document.getElementById('youReceive').textContent = youReceive.toFixed(4);
 } else {
 this.showError('No dust balances found across any chain');
 }
 }

 async aggregateDust() {
 const targetAddress = document.getElementById('targetAddress').value.trim();

 if (!targetAddress) {
 this.showError('Please enter a destination address');
 return;
 }

 if (!ethers.isAddress(targetAddress)) {
 this.showError('Invalid destination address');
 return;
 }

 if (!this.walletAddress) {
 this.showError('Please scan balances first');
 return;
 }

 // Check if wallet is connected for signing transactions
 if (!window.ethereum) {
 this.showError('Please install MetaMask to sign transactions');
 return;
 }

 this.showLoading('Preparing transactions...');

 try {
 // Get prepared transactions from backend
 const response = await fetch('/api/aggregate', {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json'
 },
 body: JSON.stringify({
 address: this.walletAddress,
 target_address: targetAddress
 })
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Failed to prepare transactions');
 }

 const data = await response.json();
 this.transactions = data.transactions;
 
 if (this.transactions.length === 0) {
 this.hideLoading();
 this.showError('No transactions to process');
 return;
 }

 // Now sign and send each transaction
 await this.signAndSendTransactions(targetAddress);
 
 } catch (error) {
 console.error('Error preparing transactions:', error);
 this.hideLoading();
 this.showError('Failed to prepare transactions: ' + error.message);
 }
 }

 async signAndSendTransactions(targetAddress) {
 const results = [];
 
 for (let i = 0; i < this.transactions.length; i++) {
 const tx = this.transactions[i];
 
 try {
 this.showLoading(`Signing transaction for ${tx.chain} (${i + 1}/${this.transactions.length})...`);
 
 // Check if we need to switch networks
 const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
 const targetChainId = '0x' + tx.chain_id.toString(16);
 
 if (currentChainId !== targetChainId) {
 try {
 await window.ethereum.request({
 method: 'wallet_switchEthereumChain',
 params: [{ chainId: targetChainId }],
 });
 } catch (switchError) {
 // This error code indicates that the chain has not been added to MetaMask
 if (switchError.code === 4902) {
 await window.ethereum.request({
 method: 'wallet_addEthereumChain',
 params: [{
 chainId: targetChainId,
 chainName: tx.chain,
 nativeCurrency: tx.native_currency,
 rpcUrls: [this.chains[tx.chain_key].rpc],
 blockExplorerUrls: null // You can add block explorer URLs here
 }],
 });
 } else {
 throw switchError;
 }
 }
 }
 
 // Sign and send transaction
 this.showLoading(`Confirming transaction for ${tx.chain}...`);
 
 const txHash = await window.ethereum.request({
 method: 'eth_sendTransaction',
 params: [{
 from: tx.from,
 to: tx.contract_address,
 value: '0x' + tx.amount.toString(16),
 data: tx.tx_data.data,
 gas: '0x' + tx.tx_data.gas.toString(16),
 gasPrice: '0x' + tx.tx_data.gasPrice.toString(16),
 }],
 });
 
 results.push({
 ...tx,
 status: 'success',
 tx_hash: txHash
 });
 
 } catch (error) {
 console.error(`Error processing ${tx.chain}:`, error);
 results.push({
 ...tx,
 status: 'failed',
 error: error.message
 });
 }
 }
 
 this.updateResultsUI({ transactions: results });
 this.hideLoading();
 }

 updateResultsUI(data) {
 document.getElementById('resultsSection').classList.remove('hidden');
 
 const resultsList = document.getElementById('resultsList');
 resultsList.innerHTML = '';

 if (data.transactions && data.transactions.length > 0) {
 data.transactions.forEach(tx => {
 const card = document.createElement('div');
 card.className = 'result-card';
 
 let txHashDisplay = '';
 if (tx.tx_hash && tx.tx_hash !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
 txHashDisplay = `<div class="tx-hash">${tx.tx_hash.slice(0, 10)}...${tx.tx_hash.slice(-8)}</div>`;
 }
 
 card.innerHTML = `
 <div class="result-info">
 <div class="chain-icon" style="background: ${tx.color}">
 ${tx.symbol[0]}
 </div>
 <div>
 <div class="chain-name">${tx.chain}</div>
 <div class="balance-amount">${tx.amount.toFixed(4)} ${tx.symbol}</div>
 ${txHashDisplay}
 </div>
 </div>
 <div class="result-status ${tx.status}">${tx.status}</div>
 `;
 resultsList.appendChild(card);
 });
 } else {
 resultsList.innerHTML = '<p class="no-results">No transactions to process</p>';
 }
 }

 showLoading(text) {
 document.getElementById('loadingText').textContent = text;
 document.getElementById('loading').classList.remove('hidden');
 }

 hideLoading() {
 document.getElementById('loading').classList.add('hidden');
 }

 showError(message) {
 document.getElementById('errorMessage').textContent = message;
 document.getElementById('error').classList.remove('hidden');
 }

 hideError() {
 document.getElementById('error').classList.add('hidden');
 }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
 window.app = new DustAggregator();
});
