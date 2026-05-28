# defarm-sdk (Rust)

Official Rust SDK for the [DeFarm](https://defarm.net) platform.

```toml
[dependencies]
defarm-sdk = "0.1"
```

## Quickstart

```rust
use defarm_sdk::{DefarmClient, DisclosureRequest};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = DefarmClient::builder()
        .api_key(std::env::var("DEFARM_API_KEY")?)
        .build()?;

    let circuits = client.circuits().list().await?;
    println!("found {} circuits", circuits.len());

    let disclosure = client
        .disclosures()
        .create(&DisclosureRequest {
            item_id: "<item_id>".into(),
            preset: "finance_basic".into(),
            audience: Some("bank_partner".into()),
            expires_in_days: None,
        })
        .await?;
    println!("proof_hash: {}", disclosure.proof_hash);
    Ok(())
}
```

## Surface

| Namespace | Methods |
| --- | --- |
| `client.circuits()` | `list`, `show` |
| `client.items()` | `list`, `show`, `create_via_ingestion` |
| `client.events()` | `list`, `show`, `add` |
| `client.disclosures()` | `create` |
| `client.receipts()` | `list`, `show` |

All methods are async (Tokio). Errors come back as `DefarmError`, which
distinguishes transport errors, gateway HTTP errors, and decode errors.

## Auth

Either `.api_key("…")` (workspace ingestion key, sent as `X-API-Key`) or
`.access_token("…")` (JWT, sent as `Authorization: Bearer …`). Without one of
these, `.build()` returns `DefarmError::MissingCredential`.

## Versioning

Mirrors the JS `@defarm/sdk` surface where possible. Breaking changes are
gated by major version bumps.

## License

MIT.
