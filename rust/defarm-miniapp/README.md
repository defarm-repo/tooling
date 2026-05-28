# defarm-miniapp (Rust)

Framework for building DeFarm miniapps in Rust, wrapping
[`defarm-sdk`](../defarm-sdk-rust/) with helpers tuned to the most common
miniapp shapes.

```toml
[dependencies]
defarm-miniapp = "0.1"
```

## Quickstart

```rust
use defarm_miniapp::DefarmMiniapp;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let app = DefarmMiniapp::builder()
        .api_key(std::env::var("DEFARM_API_KEY")?)
        .build()?;

    let items = app.items().list("<circuit_id>").await?;
    let proof = app.disclosures().for_bank(&items[0].id, None).await?;
    println!("proof_hash: {}", proof.proof_hash);
    Ok(())
}
```

## Helpers

| Namespace | Methods |
| --- | --- |
| `app.items()` | `list`, `show`, `create_beef_with_sisbov` |
| `app.events()` | `list`, `add`, `record_movement` (auto-injects `gta_number`) |
| `app.disclosures()` | `create`, `for_bank`, `for_auditor`, `for_public` |
| `app.receipts()` | `list`, `show` |
| `app.sdk()` | full `DefarmClient` escape hatch |

## Examples

- [`examples/tokenization/`](./examples/tokenization/) — Axum server exposing
  `GET /token/:dfid` returning the item plus an `audit_basic` provenance
  disclosure.
- [`examples/marketplace/`](./examples/marketplace/) — Axum server exposing
  `GET /listings` returning DFIDs for sale with `finance_basic` disclosures
  attached.

Both examples run with `cargo run` from their directory.

## License

MIT.
