import { Connection, PublicKey } from '@solana/web3.js';

export class PoolAgent {
    constructor() {
        this.connection = new Connection('https://api.mainnet-beta.solana.com');
    }

    async findProfitablePools() {
        try {
            const pools = await this.connection.getProgramAccounts(
                new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"),
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
                    data: POOL_LAYOUT.decode(data),
                };
            });

            return poolData.sort((a, b) => {
                return b.data.tokenAmountA - a.data.tokenAmountA;
            });
        } catch (error) {
            console.error('Error:', error);
            return [];
        }
    }
} 
