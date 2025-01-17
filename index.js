import { PoolAgent } from './pool-agent.js';

console.log('index.js loaded successfully!');

// Add wallet connection handling
let wallet = null;
let poolAgent = null;

async function connectWallet() {
    console.log('Connect wallet clicked!'); // Debug log
    
    try {
        const walletButton = document.getElementById('connectWallet');
        const walletStatus = document.getElementById('walletStatus');

        // Check if Phantom is installed
        if (!window.solana || !window.solana.isPhantom) {
            console.log('Phantom not found!'); // Debug log
            walletStatus.textContent = 'Please install Phantom wallet';
            walletStatus.style.color = 'red';
            return;
        }

        console.log('Phantom detected, attempting connection...'); // Debug log
        
        wallet = window.solana;
        
        if (!wallet.isConnected) {
            walletButton.textContent = 'Connecting...';
            await wallet.connect();
        }

        console.log('Wallet connected:', wallet.publicKey.toString()); // Debug log

        const publicKey = wallet.publicKey.toString();
        walletButton.textContent = `Connected: ${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`;
        walletStatus.textContent = 'Checking token holdings...';
        
        // Initialize pool agent with wallet check
        poolAgent = new PoolAgent();
        try {
            await poolAgent.findProfitablePools(wallet);
            walletStatus.textContent = 'Access granted - Loading pool data...';
            walletStatus.style.color = 'green';
        } catch (error) {
            console.error('Pool agent error:', error); // Debug log
            if (error.message.includes('need to hold Tidal Pool tokens')) {
                walletStatus.textContent = 'Access denied: You need to hold Tidal Pool tokens';
                walletStatus.style.color = 'red';
            } else {
                walletStatus.textContent = `Error: ${error.message}`;
                walletStatus.style.color = 'red';
            }
        }
    } catch (error) {
        console.error('Wallet connection error:', error); // Debug log
        const walletStatus = document.getElementById('walletStatus');
        walletStatus.textContent = `Error: ${error.message}`;
        walletStatus.style.color = 'red';
    }
}

// Make sure the DOM is loaded before adding event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, setting up wallet button...'); // Debug log
    const walletButton = document.getElementById('connectWallet');
    if (walletButton) {
        console.log('Wallet button found, adding click listener...'); // Debug log
        walletButton.addEventListener('click', connectWallet);
    } else {
        console.log('Wallet button not found!'); // Debug log
    }
});

// Handle wallet connection changes
if (window.solana) {
    window.solana.on('connect', () => {
        console.log('Wallet connected event!');
        if (poolAgent) {
            poolAgent.findProfitablePools(window.solana);
        }
    });

    window.solana.on('disconnect', () => {
        console.log('Wallet disconnected event!');
        const walletButton = document.getElementById('connectWallet');
        const walletStatus = document.getElementById('walletStatus');
        if (walletButton) walletButton.textContent = 'Connect Phantom Wallet';
        if (walletStatus) walletStatus.textContent = '';
    });
} 
document.getElementById('connectWallet').addEventListener('click', connectWallet); 
