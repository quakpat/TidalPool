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
        this.tokenMetadata = new Map();
    }

    async loadTokenMetadata() {
        try {
            const response = await fetch('https://token.jup.ag/all');
            const tokens = await response.json();
            
            tokens.forEach(token => {
                this.tokenMetadata.set(token.address, {
                    symbol: token.symbol,
                    name: token.name
                });
            });
            
            console.log('Loaded metadata for', this.tokenMetadata.size, 'tokens');
        } catch (error) {
            console.error('Error loading token metadata:', error);
        }
    }

    async findProfitablePools() {
        try {
            // Load token metadata first
            await this.loadTokenMetadata();
            
            console.log('Starting CLMM pool fetch...');
            
            // Fetch CLMM pool data
            console.log('Fetching Raydium CLMM pools...');
            const poolsResponse = await fetch('https://api.raydium.io/v2/ammV3/ammPools');
            
            if (!poolsResponse.ok) {
                throw new Error(`Pools API response error: ${poolsResponse.status}`);
            }

            const poolsData = await poolsResponse.json();

            console.log('Sample pool data:', poolsData.data[0]);

            console.log(`Fetched ${poolsData?.data?.length || 0} CLMM pools`);

            // Process pools and filter for high TVL
            const mappedPools = (poolsData?.data || [])
                .map(pool => {
                    // Log individual pool data to see available properties
                    console.log('Raw pool data:', {
                        mintA: pool.mintA,
                        mintB: pool.mintB,
                        tokenMetadataA: this.tokenMetadata.get(pool.mintA),
                        tokenMetadataB: this.tokenMetadata.get(pool.mintB),
                        fullPool: pool
                    });

                    // Extract data from day stats
                    const volume24h = parseFloat(pool.day?.volume || 0);
                    const tvl = parseFloat(pool.tvl || 0);
                    const feeRate = (pool.ammConfig?.tradeFeeRate || 0) / 1000000;
                    const fees24h = parseFloat(pool.day?.volumeFee || 0);
                    const apr = parseFloat(pool.day?.apr || 0);

                    // Get token metadata
                    const metadataA = this.tokenMetadata.get(pool.mintA);
                    const metadataB = this.tokenMetadata.get(pool.mintB);

                    // Get token symbols from metadata
                    const tokenA = metadataA?.symbol || pool.mintA.slice(0, 4) + '...' + pool.mintA.slice(-4);
                    const tokenB = metadataB?.symbol || pool.mintB.slice(0, 4) + '...' + pool.mintB.slice(-4);

                    console.log('Pool stats:', {
                        id: pool.id,
                        volume24h,
                        tvl,
                        feeRate: (feeRate * 100).toFixed(3) + '%',
                        fees24h,
                        apr: apr.toFixed(2) + '%',
                        pair: `${tokenA}/${tokenB}`
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
                        feeTier: (pool.ammConfig?.tradeFeeRate || 0) / 10000, // Convert to percentage
                        apr
                    };
                })
                .filter(pool => pool.liquidity > 0 && pool.volume24h > 0);

            console.log(`Found ${mappedPools.length} active CLMM pools with liquidity and volume`);

            const highFeePools = mappedPools
                .filter(pool => pool.fees24h >= 10)
                .sort((a, b) => b.fees24h - a.fees24h)
                .slice(0, 10)
                .map(pool => {
                    const poolUrl = `https://raydium.io/clmm/create-position/?pool_id=${pool.id}`;
                    
                    console.log('High-fee CLMM pool found:', {
                        id: pool.id,
                        pair: `${pool.tokenA}/${pool.tokenB}`,
                        fees24h: `$${pool.fees24h.toFixed(2)}`,
                        tvl: `$${pool.liquidity.toFixed(2)}`,
                        apr: `${pool.apr.toFixed(2)}%`,
                        feeTier: `${pool.feeTier}%`,
                        url: poolUrl
                    });
                    
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
                        tokenB: pool.tokenB,
                        feeTier: pool.feeTier,
                        poolUrl: poolUrl
                    };

                    metrics.profitabilityScore = this.calculateProfitabilityScore(metrics);

                    return {
                        address: pool.id,
                        type: "Raydium CLMM",
                        status: "Active",
                        lastUpdated: new Date().toISOString(),
                        metrics,
                        riskScore: this.calculateRiskScore(metrics),
                        url: poolUrl
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
                    feeTier: `${highFeePools[0].metrics.feeTier}%`,
                    url: highFeePools[0].url
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
