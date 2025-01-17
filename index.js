// Add wallet connection handling
let wallet = null;
let poolAgent = null;

async function connectWallet() {
    try {
        const walletButton = document.getElementById('connectWallet');
        const walletStatus = document.getElementById('walletStatus');

        if (!window.solana || !window.solana.isPhantom) {
            walletStatus.textContent = 'Please install Phantom wallet';
            walletStatus.style.color = 'red';
            return;
        }

        wallet = window.solana;
        
        if (!wallet.isConnected) {
            walletButton.textContent = 'Connecting...';
            await wallet.connect();
        }

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
            if (error.message.includes('need to hold Tidal Pool tokens')) {
                walletStatus.textContent = 'Access denied: You need to hold Tidal Pool tokens';
                walletStatus.style.color = 'red';
            } else {
                walletStatus.textContent = `Error: ${error.message}`;
                walletStatus.style.color = 'red';
            }
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        walletStatus.textContent = `Error: ${error.message}`;
        walletStatus.style.color = 'red';
    }
}

// Add event listener for wallet connection
document.addEventListener('DOMContentLoaded', () => {
    const walletButton = document.getElementById('connectWallet');
    if (walletButton) {
        walletButton.addEventListener('click', connectWallet);
    }
});

// Handle wallet connection changes
if (window.solana) {
    window.solana.on('connect', () => {
        console.log('Wallet connected!');
        if (poolAgent) {
            poolAgent.findProfitablePools(window.solana);
        }
    });

    window.solana.on('disconnect', () => {
        console.log('Wallet disconnected!');
        const walletButton = document.getElementById('connectWallet');
        const walletStatus = document.getElementById('walletStatus');
        if (walletButton) walletButton.textContent = 'Connect Phantom Wallet';
        if (walletStatus) walletStatus.textContent = '';
    });
} 
document.getElementById('connectWallet').addEventListener('click', connectWallet); 
