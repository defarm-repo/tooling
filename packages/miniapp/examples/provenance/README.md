# Example: consumer provenance viewer (runnable)

The farm-to-fork story for a shopper. Put a QR on the product pointing at
`GET /p/:dfid` — this app renders a simple public page from a `public_basic`
disclosure (only the fields meant for the public) with a link to verify the
on-chain anchor without any DeFarm account.

## Run it

```bash
npm install
DEFARM_API_KEY=<your_partner_key> npm start
```

Open `http://localhost:3005/p/<DFID>` in a browser, or `GET /p/<DFID>.json`
for the raw data.

Optional env: `DEFARM_GATEWAY`, `DEFARM_CIRCUIT_ID`, `PORT` (see `.env.example`).
