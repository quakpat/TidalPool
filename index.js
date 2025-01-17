// Add wallet connection handling
let wallet = null;

async function connectWallet() {
    try {
        if (!window.solana || !window.solana.isPhantom) {
            throw new Error('Phantom wallet is not installed');
        }

        wallet = window.solana;
        await wallet.connect();
        
        // Initialize pool agent with wallet check
        const poolAgent = new PoolAgent();
        try {
            await poolAgent.findProfitablePools(wallet);
        } catch (error) {
            if (error.message.includes('need to hold Tidal Pool tokens')) {
                console.error('Access denied: You need to hold Tidal Pool tokens');
            } else {
                console.error('Error:', error);
            }
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
    }
}

// Add connect wallet button to your UI
document.getElementById('connectWallet').addEventListener('click', connectWallet); 
