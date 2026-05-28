# tokenization-miniapp

Standalone Rust miniapp that turns a verified BEEF DFID into a portable
provenance package usable by any downstream system that needs to verify
the origin and history of an animal.

## What it does

- Accepts `GET /token/:dfid`.
- Looks up the item in the configured workspace circuit.
- Generates a fresh `audit_basic` selective disclosure with the partner
  workspace API key.
- Returns a JSON envelope: item + provenance (`receipt_id`, `proof_hash`,
  `disclosed_payload`).

Any party that holds the response can re-derive `proof_hash` from
`disclosed_payload` and cross-check it against the receipt on the DeFarm
platform, without needing direct access to the original workspace.

## Run

```bash
export DEFARM_API_KEY="<workspace ingestion key>"
export DEFARM_CIRCUIT_ID="<your circuit id>"
cargo run
```

Then:

```bash
curl http://localhost:3030/token/DFID-BEEF-BR-2026-000084-78422b | jq
```

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `DEFARM_API_KEY` | — (required) | Partner workspace key |
| `DEFARM_CIRCUIT_ID` | — (required) | Circuit to look items up in |
| `PORT` | `3030` | HTTP listen port |
| `RUST_LOG` | `info,tokenization_miniapp=debug` | Logging level |

## Notes for production

- Cache the `items list` call. Looking up every DFID against the full circuit
  on every request scales poorly past a few thousand items.
- Bind `audience` to the recipient identity (bank URN, fund id, etc.) so
  the receipt trail is meaningful.
- Add a real auth layer in front of `/token/:dfid` — this example trusts
  every caller, which is fine for demo and bad for production.
