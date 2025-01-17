export class PoolAgent {
    constructor() {
        this.connection = new solanaWeb3.Connection('https://rpc.helius.xyz/?api-key=b7b6ec9a-e258-4f73-ba77-429f2e0885f5');
    }

    async findProfitablePools() {
        try {
            console.log('Fetching pools...');
            const programId = new solanaWeb3.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
            
            // Fetch Raydium API data for price and volume info
            const raydiumApiData = await fetch('https://api.raydium.io/v2/main/pairs').then(res => res.json());
            
            const pools = await this.connection.getProgramAccounts(programId, {
                commitment: "confirmed",
                filters: [
                    { dataSize: 752 },
                    { memcmp: { offset: 0, bytes: "3" } }
                ],
                encoding: "base64"
            });

            const poolData = await Promise.all(pools.map(async (pool) => {
                const address = pool.pubkey.toBase58();
                const apiData = raydiumApiData.find(p => p.ammId === address);
                
                // Calculate metrics
                const metrics = await this.calculatePoolMetrics(pool, apiData);
                
                return {
                    address,
                    type: "Raydium V3",
                    status: "Active",
                    lastUpdated: new Date().toISOString(),
                    metrics,
                    riskScore: this.calculateRiskScore(metrics)
                };
            }));

            // Sort pools by profitability score
            return poolData
                .filter(pool => pool.metrics.liquidityUSD > 10000) // Min $10k liquidity
                .sort((a, b) => b.metrics.profitabilityScore - a.metrics.profitabilityScore);

        } catch (error) {
            console.error('Error in findProfitablePools:', error);
            throw error;
        }
    }

    async calculatePoolMetrics(pool, apiData) {
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
                apr: (fees24h * 365 * 100) / liquidityUSD, // Annualized fee APR
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
