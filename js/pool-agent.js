export class PoolAgent {
    constructor() {
        this.connection = new solanaWeb3.Connection(
            'https://rpc.helius.xyz/?api-key=b7b6ec9a-e258-4f73-ba77-429f2e0885f5',
            {
                commitment: 'confirmed',
                wsEndpoint: 'wss://rpc.helius.xyz/?api-key=b7b6ec9a-e258-4f73-ba77-429f2e0885f5'
            }
        );
    }

    async findProfitablePools() {
        try {
            console.log('Starting pool fetch...');
            const programId = new solanaWeb3.PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");
            
            // Log Raydium API fetch
            console.log('Fetching Raydium API data...');
            const raydiumResponse = await fetch('https://api.raydium.io/v2/ammV3/ammPools');
            const raydiumApiData = await raydiumResponse.json();
            console.log(`Fetched ${raydiumApiData.length} CLMM pairs from Raydium API`);
            
            console.log('Fetching on-chain pools...');
            
            // Simplified config for CLMM pools
            const config = {
                filters: [{
                    dataSize: 1432 // CLMM pool size
                }]
            };

            try {
                const pools = await this.connection.getProgramAccounts(
                    programId,
                    config
                );
                
                console.log(`Found ${pools.length} raw CLMM pools on-chain`);

                if (pools.length === 0) {
                    console.log('No CLMM pools found. Trying alternative approach...');
                    return [];
                }

                const poolData = await Promise.all(pools.map(async (pool) => {
                    const address = pool.pubkey.toBase58();
                    const apiData = raydiumApiData.find(p => p.id === address);
                    
                    if (!apiData) {
                        return null;
                    }

                    const metrics = await this.calculatePoolMetrics(pool, apiData);
                    
                    if (!metrics) {
                        return null;
                    }

                    return {
                        address,
                        type: "Raydium CLMM",
                        status: "Active",
                        lastUpdated: new Date().toISOString(),
                        metrics,
                        riskScore: this.calculateRiskScore(metrics)
                    };
                }));

                // Filter out null values and apply liquidity filter
                const validPools = poolData
                    .filter(pool => pool !== null && pool.metrics?.liquidityUSD > 10000)
                    .sort((a, b) => b.metrics.profitabilityScore - a.metrics.profitabilityScore);

                console.log(`Found ${validPools.length} valid CLMM pools after filtering`);
                return validPools;

            } catch (rpcError) {
                console.error('RPC Error:', rpcError);
                
                // Fallback to using Raydium API data only
                console.log('Falling back to Raydium API data...');
                const poolData = raydiumApiData
                    .filter(pool => {
                        const fees24h = (pool.volume24h || 0) * 0.0025; // 0.25% fee
                        return fees24h >= 10000; // Only pools with $10k+ daily fees
                    })
                    .sort((a, b) => (b.volume24h * 0.0025) - (a.volume24h * 0.0025)) // Sort by fees
                    .slice(0, 10) // Top 10 pools
                    .map(apiData => {
                        console.log('Processing CLMM pool data:', apiData);
                        
                        // Fix token name display
                        const [tokenA, tokenB] = (apiData.name || '').split('/').slice(0, 2);
                        const fees24h = (apiData.volume24h || 0) * 0.0025;
                        
                        const metrics = {
                            liquidityUSD: apiData.liquidity || 0,
                            volume24h: apiData.volume24h || 0,
                            fees24h: fees24h,
                            priceImpact: this.calculatePriceImpact(apiData.liquidity || 0, 1000),
                            ilRisk: this.calculateILRisk(apiData.price24hChange),
                            activityScore: Math.min(100, ((apiData.volume24h || 0) / (apiData.liquidity || 1)) * 100),
                            profitabilityScore: 0,
                            apr: (fees24h * 365 * 100) / (apiData.liquidity || 1),
                            tokenA: tokenA || 'Unknown',
                            tokenB: tokenB || 'Unknown'
                        };

                        // Calculate profitability score
                        metrics.profitabilityScore = this.calculateProfitabilityScore(metrics);

                        return {
                            address: apiData.id,
                            type: "Raydium CLMM",
                            status: "Active",
                            lastUpdated: new Date().toISOString(),
                            metrics,
                            riskScore: this.calculateRiskScore(metrics)
                        };
                    });

                console.log('Sample CLMM pool data:', poolData[0]);
                console.log(`Found ${poolData.length} high-volume CLMM pools`);
                return poolData;
            }

        } catch (error) {
            console.error('Error in findProfitablePools:', error);
            throw error;
        }
    }

    calculatePoolMetrics(pool, apiData) {
        try {
            const volume24h = apiData?.volume24h || 0;
            const liquidityUSD = apiData?.liquidity || 0;
            const fees24h = volume24h * 0.0025; // 0.25% fee
            
            // Calculate price impact for a $1000 trade
            const priceImpact = this.calculatePriceImpact(liquidityUSD, 1000);
            
            // Calculate impermanent loss risk based on 24h price volatility
            const ilRisk = this.calculateILRisk(apiData?.price24hChange);
            
            // Calculate trading activity score (0-100)
            const activityScore = Math.min(100, (volume24h / liquidityUSD) * 100);
            
            // Calculate profitability score (0-100)
            const profitabilityScore = this.calculateProfitabilityScore({
                volume24h,
                liquidityUSD,
                fees24h,
                priceImpact,
                ilRisk,
                activityScore
            });

            return {
                liquidityUSD,
                volume24h,
                fees24h,
                priceImpact,
                ilRisk,
                activityScore,
                profitabilityScore,
                apr: (fees24h * 365 * 100) / liquidityUSD,
                tokenA: apiData?.token0Symbol || 'Unknown',
                tokenB: apiData?.token1Symbol || 'Unknown'
            };
        } catch (error) {
            console.error('Error calculating metrics:', error);
            return null;
        }
    }

    calculatePriceImpact(liquidity, tradeAmount) {
        // Simplified constant product formula
        return (tradeAmount / liquidity) * 100;
    }

    calculateILRisk(priceChange24h) {
        if (!priceChange24h) return 50; // Default medium risk
        // Calculate IL based on price change
        const change = Math.abs(priceChange24h);
        return Math.min(100, (change * 2));
    }

    calculateProfitabilityScore(metrics) {
        // Weighted scoring system
        const weights = {
            volume: 0.3,
            liquidity: 0.2,
            fees: 0.2,
            priceImpact: 0.1,
            ilRisk: 0.1,
            activity: 0.1
        };

        let score = 0;
        score += (metrics.volume24h / metrics.liquidityUSD) * weights.volume * 100;
        score += Math.min(100, (metrics.liquidityUSD / 1000000)) * weights.liquidity;
        score += (metrics.fees24h / metrics.liquidityUSD) * weights.fees * 10000;
        score += (100 - metrics.priceImpact) * weights.priceImpact;
        score += (100 - metrics.ilRisk) * weights.ilRisk;
        score += metrics.activityScore * weights.activity;

        return Math.min(100, Math.max(0, score));
    }

    calculateRiskScore(metrics) {
        // Risk scoring from 1 (lowest) to 10 (highest)
        const riskFactors = {
            lowLiquidity: metrics.liquidityUSD < 50000,
            highPriceImpact: metrics.priceImpact > 5,
            highILRisk: metrics.ilRisk > 70,
            lowVolume: metrics.volume24h < 10000,
            lowActivity: metrics.activityScore < 20
        };

        return Object.values(riskFactors).filter(Boolean).length;
    }
} 
