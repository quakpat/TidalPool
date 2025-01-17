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
            
            // Fetch pool data from v3 API
            console.log('Fetching Raydium pools...');
            const poolsResponse = await fetch('https://api.raydium.io/v2/main/pairs');
            
            if (!poolsResponse.ok) {
                throw new Error(`Pools API response error: ${poolsResponse.status}`);
            }

            const poolsData = await poolsResponse.json();
            console.log(`Fetched ${poolsData?.length || 0} pools`);
            console.log('Sample pool data:', poolsData?.[0]);

            if (!Array.isArray(poolsData)) {
                throw new Error('Invalid API response structure');
            }

            console.log('Processing pools...');
            
            // Process pools and filter for high TVL
            const mappedPools = poolsData
                .map(pool => {
                    // Extract relevant data
                    const liquidity = parseFloat(pool.liquidity || 0);
                    const volume24h = parseFloat(pool.volume24h || 0);
                    const fees24h = volume24h * 0.0025; // 0.25% fee
                    const apr = parseFloat(pool.apr24h || 0);

                    return {
                        id: pool.ammId,
                        liquidity,
                        volume24h,
                        fees24h,
                        apr,
                        tokenA: pool.name?.split('/')[0] || 'Unknown',
                        tokenB: pool.name?.split('/')[1] || 'Unknown',
                        priceChange24h: pool.priceChange24h,
                        mintA: pool.baseMint,
                        mintB: pool.quoteMint
                    };
                })
                .filter(pool => pool.liquidity > 0); // Filter out pools with no liquidity

            console.log(`Found ${mappedPools.length} active pools`);

            const highFeePools = mappedPools
                .filter(pool => pool.fees24h >= 10000) // Only pools with $10k+ daily fees
                .sort((a, b) => b.fees24h - a.fees24h)
                .slice(0, 10)
                .map(pool => {
                    console.log('Processing high-fee pool:', pool.id, 'Fees:', pool.fees24h.toFixed(2), 'TVL:', pool.liquidity.toFixed(2));
                    
                    const metrics = {
                        liquidityUSD: pool.liquidity,
                        volume24h: pool.volume24h,
                        fees24h: pool.fees24h,
                        priceImpact: this.calculatePriceImpact(pool.liquidity, 1000),
                        ilRisk: this.calculateILRisk(pool.priceChange24h),
                        activityScore: Math.min(100, (pool.volume24h / (pool.liquidity || 1)) * 100),
                        profitabilityScore: 0,
                        apr: pool.apr,
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB
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
            if (highFeePools.length > 0) {
                console.log('Top pool:', {
                    address: highFeePools[0].address,
                    tokens: `${highFeePools[0].metrics.tokenA}/${highFeePools[0].metrics.tokenB}`,
                    fees24h: highFeePools[0].metrics.fees24h.toFixed(2),
                    tvl: highFeePools[0].metrics.liquidityUSD.toFixed(2),
                    apr: highFeePools[0].metrics.apr.toFixed(2) + '%'
                });
            }
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
