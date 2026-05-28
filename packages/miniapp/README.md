# @defarm/miniapp

Framework for building standalone applications on top of the
[DeFarm](https://defarm.net) platform.

A **miniapp** is a server-side or web application that you (the partner)
host yourself, that consumes the DeFarm public API through this package.
The framework wraps [`@defarm/sdk`](https://www.npmjs.com/package/@defarm/sdk)
with helpers tuned to the most common shapes: tokenization, marketplace,
viewer, certifier dashboard.

## Install

```bash
npm install @defarm/miniapp
```

You will also need credentials. The recommended path is a
**workspace ingestion API key** issued from your partner workspace at
`https://defarm.net/app/partner`.

## Quickstart

```ts
import { DefarmMiniapp } from "@defarm/miniapp";

const app = new DefarmMiniapp({
  apiKey: process.env.DEFARM_API_KEY,
});

const circuitId = "<your-circuit-id>";

const items = await app.items.list({ circuitId, limit: 10 });
console.log(items);

const disclosure = await app.disclosures.forBank(items.items[0].id);
console.log(disclosure.proof_hash);
```

## What's in the box

| API | Wraps | Notes |
| --- | --- | --- |
| `app.items.list / show / createBeefWithSisbov` | `sdk.items.*` | `createBeefWithSisbov` enforces canonical identifier upfront |
| `app.events.add / recordMovement` | `sdk.events.*` | `recordMovement` injects the required `gta_number` field |
| `app.disclosures.create / forBank / forAuditor / forPublic` | `sdk.disclosures.*` | Audience presets matching the platform's allowlist |
| `app.receipts.list / show` | `sdk.receipts.*` | Read access to ingestion + disclosure receipts |
| `app.sdk` | `DefarmSdk` | Full SDK escape hatch for advanced flows |

## Scaffolding

```bash
npx create-defarm-miniapp my-app
cd my-app
npm install
npm run dev
```

(See `create-defarm-miniapp` — published separately.)

## Examples

- [`examples/tokenization`](./examples/tokenization/README.md) — turn a
  verified BEEF item into a tokenized representation usable by downstream
  finance systems.
- [`examples/marketplace`](./examples/marketplace/README.md) — list DFIDs
  available for sale with disclosures attached for buyer verification.

## License

MIT.
