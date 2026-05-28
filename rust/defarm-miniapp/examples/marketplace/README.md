# marketplace-miniapp

Standalone Rust miniapp that lists DFIDs available for sale from a
workspace circuit, with a `finance_basic` selective disclosure attached
so buyers can verify provenance before settling off-platform.

## What it does

- Accepts `GET /listings`.
- Lists items in the configured circuit.
- Filters items with `price_brl` in their metadata.
- For each matched item, creates a fresh `finance_basic` disclosure with
  `audience: "marketplace"`.
- Returns `{ listings: [{dfid, price_brl, provenance}], count, circuit_id }`.

The miniapp does **not** move money. It publishes the verifiable
provenance data that buyers need before paying through any rail.

## Run

```bash
export DEFARM_API_KEY="<workspace ingestion key>"
export DEFARM_CIRCUIT_ID="<your circuit id>"
cargo run
```

Then:

```bash
curl http://localhost:3031/listings | jq
```

## Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `DEFARM_API_KEY` | — (required) | Partner workspace key |
| `DEFARM_CIRCUIT_ID` | — (required) | Circuit to list items from |
| `PORT` | `3031` | HTTP listen port |
| `RUST_LOG` | `info,marketplace_miniapp=debug` | Logging level |

## Item metadata contract

For an item to appear as a listing, its `metadata` must include a
`price_brl` field. Any other shape (string, number, object) is passed
through unchanged to the response.

```json
{
  "metadata": {
    "sisbov": "105500497533895",
    "price_brl": 4200
  }
}
```

## Notes for production

- Cache the per-item disclosure. The current code creates a fresh receipt
  on every request which is fine for demos and wasteful at scale.
- Validate the price metadata schema rather than passing it through
  verbatim, especially if the field crosses workspaces.
- Front the endpoint with rate limiting; disclosure creation is cheap
  on the gateway but creates audit-relevant receipts.
