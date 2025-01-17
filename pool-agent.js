export class PoolAgent {
    constructor() {
        this.connection = new solanaWeb3.Connection(
            'https://rpc.helius.xyz/?api-key=b7b6ec9a-e258-4f73-ba77-429f2e0885f5',
            {
                commitment: 'confirmed',
                wsEndpoint: 'wss://rpc.helius.xyz/?api-key=b7b6ec9a-e258-4f73-ba77-429f2e0885f5'
            }
        );
        this.tokenMetadata = new Map();
        this.TIDAL_TOKEN_MINT = 'RBCDN1DniDSEAogeCgmzXCgoxKpv1nofWsmMjTTVzqd';
        this.authenticated = false;

        // Common token address mapping
        this.tokenMap = {
            'So11111111111111111111111111111111111111112': 'SOL',
            'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
            'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
            'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
            'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
            // Add more token mappings as needed
        };
    }

    // Add this helper method
    getTokenSymbol(mintAddress) {
        return this.tokenMap[mintAddress] || mintAddress.slice(0, 4) + '...' + mintAddress.slice(-4);
    }

    // Then update the mapping code
    const mappedPools = (poolsData?.data || [])
        .map(pool => {
            // Extract data from day stats
            const volume24h = parseFloat(pool.day?.volume || 0);
            const tvl = parseFloat(pool.tvl || 0);
            const feeRate = (pool.ammConfig?.tradeFeeRate || 0) / 1000000;
            const fees24h = parseFloat(pool.day?.volumeFee || 0);
            const apr = parseFloat(pool.day?.apr || 0);

            // Get token metadata
            const metadataA = this.tokenMetadata.get(pool.mintA);
            const metadataB = this.tokenMetadata.get(pool.mintB);
            
            // Helper function to get token name
            const getTokenName = (address, metadata) => {
                if (metadata?.symbol) return metadata.symbol;
                if (address.toLowerCase().includes('pump')) return 'PUMP';
                return address.slice(0, 4) + '...' + address.slice(-4);
            };

            // Get token symbols from metadata
            const tokenA = getTokenName(pool.mintA, metadataA);
            const tokenB = getTokenName(pool.mintB, metadataB);

            console.log('Token Metadata:', {
                mintA: pool.mintA,
                mintB: pool.mintB,
                metadataA,
                metadataB
            });

            console.log('Resolved Tokens:', {
                tokenA,
                tokenB
            });

            return {
                id: pool.id,
                liquidity: tvl,
                volume24h,
                fees24h,
                tokenA,
                tokenB,
                priceChange24h: (pool.day?.priceMax - pool.day?.priceMin) / pool.day?.priceMin * 100,
                mintA: pool.mintA,
                mintB: pool.mintB,
                tickSpacing: pool.tickSpacing,
                feeTier: (pool.ammConfig?.tradeFeeRate || 0) / 10000,
                apr
            };
        })

    // ... rest of the class implementation ...
} 
