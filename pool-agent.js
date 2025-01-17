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
        this.TIDAL_TOKEN_MINT = 'RBCDN1DniDSEAogeCgmzXCgoxKpv1nofWsmMjTTVzqd';
        this.authenticated = false;
    }
    // ... rest of the class implementation ...
} 
