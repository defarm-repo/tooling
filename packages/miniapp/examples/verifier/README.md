# Example: independent verifier (runnable)

Don't trust DeFarm. This app reads the on-chain reference (Stellar tx + IPFS CID)
from DeFarm's public verify endpoint once, then confirms it **independently** —
the transaction against Stellar's own Horizon API and the snapshot against public
IPFS gateways. DeFarm cannot forge a Horizon response or an IPFS content address,
so a green verdict is proof, not DeFarm's word.

## Run it

```bash
npm install
DEFARM_API_KEY=<your_partner_key> npm start
```

```bash
curl http://localhost:3004/verify/<DFID>
```

Response: DeFarm's claim, the independent Horizon + IPFS checks, and a verdict.

Optional env: `DEFARM_GATEWAY`, `PORT` (see `.env.example`).
