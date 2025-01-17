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
            console.log('Starting CLMM pool fetch...');
            
            // Fetch CLMM pool data
            console.log('Fetching Raydium CLMM pools...');
            const poolsResponse = await fetch('https://api.raydium.io/v2/ammV3/ammPools');
            
            if (!poolsResponse.ok) {
                throw new Error(`Pools API response error: ${poolsResponse.status}`);
            }

            const poolsData = await poolsResponse.json();

            console.log(`Fetched ${poolsData?.data?.length || 0} CLMM pools`);
            console.log('Sample CLMM pool:', poolsData?.data?.[0]);

            // Process pools and filter for high TVL
            const mappedPools = (poolsData?.data || [])
                .map(pool => {
                    // Extract data directly from pool
                    const volume24h = parseFloat(pool.volume24h || 0);
                    const tvl = parseFloat(pool.tvl || 0);
                    const feeRate = pool.ammConfig.tradeFeeRate / 1000000; // Convert from parts per million to decimal
                    const fees24h = volume24h * feeRate;

                    return {
                        id: pool.id,
                        liquidity: tvl,
                        volume24h,
                        fees24h,
                        tokenA: pool.tokenASymbol || pool.tokenA || 'Unknown',
                        tokenB: pool.tokenBSymbol || pool.tokenB || 'Unknown',
                        priceChange24h: pool.price24hChange,
                        mintA: pool.mintA,
                        mintB: pool.mintB,
                        tickSpacing: pool.tickSpacing,
                        feeTier: pool.ammConfig.tradeFeeRate / 10000 // Convert to percentage
                    };
                })
                .filter(pool => pool.liquidity > 0);

            console.log(`Found ${mappedPools.length} active CLMM pools with liquidity`);

            const highFeePools = mappedPools
                .filter(pool => pool.fees24h >= 10000)
                .sort((a, b) => b.fees24h - a.fees24h)
                .slice(0, 10)
                .map(pool => {
                    console.log('Processing high-fee CLMM pool:', 
                        `\nID: ${pool.id}`,
                        `\nPair: ${pool.tokenA}/${pool.tokenB}`,
                        `\nFees: $${pool.fees24h.toFixed(2)}`, 
                        `\nTVL: $${pool.liquidity.toFixed(2)}`,
                        `\nFee Tier: ${pool.feeTier}%`
                    );
                    
                    const metrics = {
                        liquidityUSD: pool.liquidity,
                        volume24h: pool.volume24h,
                        fees24h: pool.fees24h,
                        priceImpact: this.calculatePriceImpact(pool.liquidity, 1000),
                        ilRisk: this.calculateILRisk(pool.priceChange24h),
                        activityScore: Math.min(100, (pool.volume24h / (pool.liquidity || 1)) * 100),
                        profitabilityScore: 0,
                        apr: (pool.fees24h * 365 * 100) / (pool.liquidity || 1),
                        tokenA: pool.tokenA,
                        tokenB: pool.tokenB,
                        feeTier: pool.feeTier
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
                console.log('Top CLMM pool:', {
                    address: highFeePools[0].address,
                    tokens: `${highFeePools[0].metrics.tokenA}/${highFeePools[0].metrics.tokenB}`,
                    fees24h: `$${highFeePools[0].metrics.fees24h.toFixed(2)}`,
                    tvl: `$${highFeePools[0].metrics.liquidityUSD.toFixed(2)}`,
                    apr: `${highFeePools[0].metrics.apr.toFixed(2)}%`,
                    feeTier: `${highFeePools[0].metrics.feeTier}%`
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
