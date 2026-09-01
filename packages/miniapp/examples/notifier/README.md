# Example: receipts notifier (runnable)

The integration shape: watch the receipts feed for a circuit and POST to a
webhook (Slack, Telegram, your own endpoint) whenever a new receipt lands — a
fresh ingestion or a new selective disclosure. This is how a partner wires
DeFarm activity into the tools their team already uses.

## Run it

```bash
npm install
DEFARM_API_KEY=<your_partner_key> npm start
```

Without `WEBHOOK_URL` it prints notifications to the console (dry-run). Set
`WEBHOOK_URL` to a Slack-compatible endpoint to actually post, and `POLL_SECONDS`
to tune the cadence (default 30).

Optional env: `DEFARM_GATEWAY`, `DEFARM_CIRCUIT_ID`, `WEBHOOK_URL`, `POLL_SECONDS`.
