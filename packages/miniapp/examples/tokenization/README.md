# Example: tokenization miniapp (runnable)

Turns a verified DeFarm item into a tokenized representation usable by
downstream financial systems: identity + auditable provenance disclosure
(`audit_basic` preset) + the item's public on-chain anchor (Stellar mainnet).

## Run it

```bash
npm install
DEFARM_API_KEY=<your_partner_key> npm start
```

The server prints a ready-to-run `curl` for a sample DFID, e.g.:

```bash
curl http://localhost:3000/token/DFID-BEEF-BR-2026-000084-78422b
```

Response: `token` (identity), `provenance` (disclosure receipt + proof hash +
disclosed fields), `anchor` (Stellar transaction + IPFS CID) and a
`verify_yourself` URL that needs no authentication.

Optional env: `DEFARM_GATEWAY`, `DEFARM_CIRCUIT_ID`, `PORT` (see `.env.example`).
