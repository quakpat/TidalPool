export class PoolAgent {
    constructor() {
        this.connection = new solanaWeb3.Connection('https://rpc.helius.xyz/?api-key=YOUR_API_KEY');
    }

    async findProfitablePools() {
        try {
            console.log('Fetching pools...');
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

            console.log('Processing pool data...');
            const poolData = pools.map((pool) => {
                const { data } = pool.account;
                return {
                    address: pool.pubkey,
                    data: data
                };
            });

            return poolData.sort((a, b) => {
                return b.data.length - a.data.length;
            });
        } catch (error) {
            console.error('Error in findProfitablePools:', error);
            throw error; // Propagate error to be handled by UI
        }
    }
} 
