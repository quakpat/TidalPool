export class PoolAgent {
    constructor() {
        this.connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com');
    }

    async findProfitablePools() {
        try {
            const pools = await this.connection.getProgramAccounts(
                new solanaWeb3.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
                {
                    filters: [
                        {
                            dataSize: 752,
                        },
                    ],
                }
            );

            const poolData = pools.map((pool) => {
                const { data } = pool.account;
                return {
                    address: pool.pubkey,
                    data: data // Temporarily remove POOL_LAYOUT.decode since we don't have buffer-layout
                };
            });

            return poolData.sort((a, b) => {
                return b.data.length - a.data.length; // Temporary sort by data length
            });
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    }
} 
