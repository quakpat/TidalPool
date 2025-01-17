// const { ApiPoolInfoV4, MARKET_STATE_LAYOUT_V3, Market } = window.raydiumSdk;

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
            
            // First, get the pools list
            console.log('Fetching Raydium CLMM API data...');
            const poolsResponse = await fetch('https://api.raydium.io/v2/ammV3/ammPools', {
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!poolsResponse.ok) {
                throw new Error(`API response error: ${poolsResponse.status}`);
            }

            const poolsData = await poolsResponse.json();
            console.log(`Fetched ${poolsData?.data?.length || 0} CLMM pairs from Raydium API`);
            console.log('Sample raw API data:', poolsData?.data?.[0]);

            // Now get the 24h stats
            console.log('Fetching pool statistics...');
            const statsResponse = await fetch('https://api.raydium.io/v2/ammV3/poolStats', {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!statsResponse.ok) {
                throw new Error(`Stats API response error: ${statsResponse.status}`);
            }

            const statsData = await statsResponse.json();
            console.log('Sample stats data:', statsData?.data?.[0]);

            // Combine pool and stats data
            const highFeePools = (poolsData?.data || [])
                .map(pool => {
                    const stats = statsData?.data?.find(stat => stat.poolId === pool.id);
                    if (!stats) return null;

                    const volume24h = parseFloat(stats.volume24h || 0);
                    const fees24h = volume24h * 0.0025; // 0.25% fee
                    const liquidity = parseFloat(stats.liquidity || 0);

                    return {
                        pool,
                        stats,
                        fees24h,
                        volume24h,
                        liquidity
                    };
                })
                .filter(item => {
                    return item && item.fees24h >= 10000; // Only pools with $10k+ daily fees
                })
                .sort((a, b) => b.fees24h - a.fees24h)
                .slice(0, 10)
                .map(({ pool, stats, fees24h, volume24h, liquidity }) => {
                    console.log('Processing high-fee pool:', pool.id, fees24h);
                    
                    const metrics = {
                        liquidityUSD: liquidity,
                        volume24h: volume24h,
                        fees24h: fees24h,
                        priceImpact: this.calculatePriceImpact(liquidity, 1000),
                        ilRisk: this.calculateILRisk(stats.priceChange24h),
                        activityScore: Math.min(100, (volume24h / liquidity) * 100),
                        profitabilityScore: 0,
                        apr: (fees24h * 365 * 100) / liquidity,
                        tokenA: pool.tokenASymbol || 'Unknown',
                        tokenB: pool.tokenBSymbol || 'Unknown'
                    };

                    metrics.profitabilityScore = this.calculateProfitabilityScore(metrics);

                    return {
                        address: pool.id,
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
