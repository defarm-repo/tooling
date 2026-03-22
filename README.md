# DeFarm Tooling

Public developer tooling for the DeFarm platform.
Agricultural traceability anchored on Stellar.

This repository was recently extracted from a larger private DeFarm product monorepo and is being progressively opened in public.

## Packages

| Package | Version | Description |
|---|---:|---|
| `@defarm/sdk` | `0.1.5` | TypeScript SDK for the DeFarm gateway |
| `@defarm/cli` | `0.1.10` | CLI built on top of the SDK |

## Quick Install

```bash
npm install -g @defarm/cli
defarm --version
# 0.1.10
```

## Quick Start (5 minutes)

```bash
# 1. Login
defarm auth login --email <email> --password <password>

# 2. List your circuits
defarm circuits list

# 3. Create an item with a canonical identifier
defarm items new \
  --value-chain BEEF \
  --year 2026 \
  --country BR \
  --circuit-id <circuit-id> \
  --metadata '{"sisbov":"105500497219983","breed":"Nelore"}'

# 4. Add an event
defarm events add \
  --event-type item_weighed \
  --item-id <item-id> \
  --circuit-id <circuit-id> \
  --payload '{"weight_kg":520}'
```

## Demo Account

For testing access, request credentials via [gabriel@defarm.net](mailto:gabriel@defarm.net).

## Documentation

Full docs: [docs.defarm.net](https://docs.defarm.net)

## Gateway

Production: [gateway.defarm.net](https://gateway.defarm.net)

## Local Workspace

```bash
npm install
npm run build
npm test
```

## License

MIT
