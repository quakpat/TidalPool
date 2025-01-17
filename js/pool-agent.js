import { ApiPoolInfoV4, MARKET_STATE_LAYOUT_V3, Market } from "@raydium-io/raydium-sdk";

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
            
            // Using Raydium's official API endpoint for CLMM
            console.log('Fetching Raydium CLMM API data...');
            const raydiumResponse = await fetch('https://api.raydium.io/v2/ammV3/ammPools', {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!raydiumResponse.ok) {
                throw new Error(`API response error: ${raydiumResponse.status}`);
            }

            const raydiumApiData = await raydiumResponse.json();
            console.log(`Fetched ${raydiumApiData?.data?.length || 0} CLMM pairs from Raydium API`);
            console.log('Sample raw API data:', raydiumApiData?.data?.[0]);

            // Filter and sort pools by fees
            const highFeePools = (raydiumApiData?.data || [])
                .filter(pool => {
                    const fees24h = (pool.volume24h || 0) * 0.0025; // 0.25% fee
                    return fees24h >= 10000; // Only pools with $10k+ daily fees
                })
                .sort((a, b) => (b.volume24h * 0.0025) - (a.volume24h * 0.0025))
                .slice(0, 10)
                .map(apiData => {
                    console.log('Processing CLMM pool data:', apiData);
                    
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
                        tokenA: apiData.token0Symbol || apiData.token0 || 'Unknown',
                        tokenB: apiData.token1Symbol || apiData.token1 || 'Unknown'
                    };

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

            console.log(`Found ${highFeePools.length} high-fee CLMM pools`);
            return highFeePools;

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
