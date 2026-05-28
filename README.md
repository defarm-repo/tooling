# DeFarm Tooling

Public developer tooling for the [DeFarm](https://defarm.net) platform.
Agricultural traceability anchored on Stellar mainnet.

This repository is the public snapshot of the developer tooling that ships
with the DeFarm product. The product monorepo stays private; everything a
developer or grant reviewer needs to use, audit or build on the platform
is open here.

## What's inside

### TypeScript (`packages/`)

| Package | Version | npm | Description |
| --- | ---: | --- | --- |
| `@defarm/sdk` | `0.1.6` | <https://www.npmjs.com/package/@defarm/sdk> | TypeScript SDK for the DeFarm gateway |
| `@defarm/cli` | `0.1.11` | <https://www.npmjs.com/package/@defarm/cli> | CLI built on top of the SDK |
| `@defarm/miniapp` | `0.1.0` | <https://www.npmjs.com/package/@defarm/miniapp> | Framework for building standalone DeFarm miniapps |

### Rust (`rust/`)

| Crate | Version | Description |
| --- | ---: | --- |
| `defarm-sdk` | `0.1.0` | Rust SDK for the DeFarm gateway (mirrors the TS surface) |
| `defarm-miniapp` | `0.1.0` | Rust miniapp framework on top of `defarm-sdk` |
| `defarm-miniapp/examples/tokenization` | — | Axum server exposing `GET /token/:dfid` with a fresh provenance disclosure |
| `defarm-miniapp/examples/marketplace` | — | Axum server exposing `GET /listings` with finance disclosures attached |

## Quick start (TypeScript)

```bash
npm install -g @defarm/cli
defarm --version
# 0.1.11

defarm auth api-key --key "<your_partner_api_key>"
defarm circuits list
defarm items list --circuit <CID>
defarm disclosures create --item-id <ID> \
  --preset finance_basic --audience bank_partner
```

## Quick start (Rust)

```toml
# Cargo.toml
[dependencies]
defarm-sdk     = "0.1"
defarm-miniapp = "0.1"
```

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

Two runnable example miniapps live under `rust/defarm-miniapp/examples/`.

## Selective disclosure presets

| Preset | Typical audience | Fields exposed |
| --- | --- | --- |
| `finance_basic` | Banks, investors | country, value_chain, year, weight_kg |
| `audit_basic` | Certifiers, auditors | weight_kg only |
| `public_basic` | Anyone | country, value_chain, year |

The disclosure handler enforces workspace ownership of the item, so a
partner can only disclose data from their own circuits.

## Typed events with regulatory validation

- `item_movement` requires `gta_number` in the payload (Brazilian cattle
  movement is regulated through GTAs).
- `BEEF` value chain requires a canonical identifier: SISBOV (14-15 digits)
  or ISO 11784 chip (15 numeric digits). The backend rejects rows that
  don't carry one, with an actionable error message.

## Gateway and docs

- Production gateway: <https://gateway.defarm.net>
- Public dashboard: <https://defarm.net>
- API documentation: <https://docs.defarm.net>
- OpenAPI spec: <https://docs.defarm.net/openapi.yaml>
- Swagger UI (partner endpoints): <https://docs.defarm.net/swagger-partner.html>
- Postman collection: <https://docs.defarm.net/postman-partner-collection.json>

## SCF #40 Build Award

This tooling is part of DeFarm's SCF #40 Build Award deliverables
(Tranches 2 and 3).

- **M2 demo video:** <https://youtu.be/3Plp8qwnn5k> (terminal walkthrough
  of the seven M2 deliverables running live against the production gateway).
- On-chain evidence (Stellar mainnet as of 2026-05-28):
  - 3,336 anchor records
  - 1,749 confirmed by the listener
  - 805 NFT mints
- SCF Build Award receiving wallet:
  <https://stellar.expert/explorer/public/account/GCS5KMW6HBKAVPY3B7SFVFX2DUQIXDADHIMIHGDMU43ZKRYYWGQT2KXN>

## Local workspace

```bash
npm install      # installs all three packages in workspace mode
npm run build
npm test

# Rust
cd rust/defarm-sdk     && cargo test
cd ../defarm-miniapp   && cargo test
```

## License

See [LICENSE](./LICENSE). Contributing guidelines in
[CONTRIBUTING.md](./CONTRIBUTING.md).
