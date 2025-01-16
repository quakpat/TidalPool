export class PoolAgent {
    constructor() {
        this.connection = new solanaWeb3.Connection('https://rpc.helius.xyz/?api-key=b7b6ec9a-e258-4f73-ba77-429f2e0885f5');
    }

    async findProfitablePools() {
        try {
            console.log('Fetching pools...');
            const programId = new solanaWeb3.PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");
            
            const config = {
                commitment: "confirmed",
                filters: [{
                    memcmp: {
                        offset: 0,
                        bytes: "3"
                    }
                }],
                dataSlice: {
                    offset: 0,
                    length: 100
                }
            };

            const pools = await this.connection.getProgramAccounts(
                programId,
                config
            );

            console.log(`Found ${pools.length} raw pools`);

            const poolData = pools.map((pool) => {
                return {
                    address: pool.pubkey.toBase58(),
                    data: pool.account.data
                };
            });

            console.log(`Processed ${poolData.length} pools`);
            return poolData;

        } catch (error) {
            console.error('Error in findProfitablePools:', error);
            throw new Error(`Failed to fetch pools: ${error.message}`);
        }
    }
} 
