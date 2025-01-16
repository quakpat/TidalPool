export class PoolAgent {
    constructor() {
        this.connection = new solanaWeb3.Connection('https://rpc.helius.xyz/?api-key=b7b6ec9a-e258-4f73-ba77-429f2e0885f5');
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
                        }
                    ],
                    encoding: "base64",
                    commitment: "confirmed"
                }
            );

            console.log(`Found ${pools.length} raw pools`);

            const poolData = pools.map((pool) => {
                return {
                    address: pool.pubkey.toBase58(),
                    data: pool.account.data
                };
            });

            const sortedPools = poolData.sort((a, b) => {
                return b.data.length - a.data.length;
            });

            console.log(`Processed ${sortedPools.length} pools`);
            return sortedPools;

        } catch (error) {
            console.error('Error in findProfitablePools:', error);
            throw error;
        }
    }
} 
