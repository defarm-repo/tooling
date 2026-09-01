# Example: marketplace miniapp (runnable)

Lists DFIDs available for sale in a circuit, each with a `finance_basic`
disclosure (audience: `marketplace`) that a buyer can verify before settling
off-platform.

## Run it

```bash
npm install
DEFARM_API_KEY=<your_partner_key> npm start
```

Then:

```bash
curl http://localhost:3001/listings
```

Response: up to 3 listings with DFID, listing metadata (weight/breed/price when
present on the item), the disclosure receipt (`receipt_id` + `proof_hash`) and a
public `verify_yourself` URL that needs no authentication.

Optional env: `DEFARM_GATEWAY`, `DEFARM_CIRCUIT_ID`, `PORT` (see `.env.example`).
If port 3001 is taken on your machine (`EADDRINUSE`), run with `PORT=3101 npm start`.
