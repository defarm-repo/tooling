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

Eight **runnable** examples live under [`examples/`](./examples/) — each is a full
project, not a snippet. Run any of them with three commands:

```bash
cd examples/<name>
npm install
DEFARM_API_KEY=<your partner key> npm start   # the reader needs no key
```

They read verified traceability data from the live DeFarm gateway.

| Example | What it does |
| --- | --- |
| [`tokenization`](./examples/tokenization) | `GET /token/:dfid` — a verified item's identity + an audit disclosure + its on-chain anchor |
| [`marketplace`](./examples/marketplace) | `GET /listings` — items for sale with finance disclosures a buyer can verify |
| [`partnership`](./examples/partnership) | `GET /partnership/:dfid` — the livestock partnership split, computed from verified weighing events |
| [`credit-precheck`](./examples/credit-precheck) | `GET /credit/:dfid` — a lender's finance disclosure plus a transparent risk signal from the animal's history |
| [`verifier`](./examples/verifier) | `GET /verify/:dfid` — confirms the anchor independently on Stellar Horizon + IPFS, not via DeFarm |
| [`provenance`](./examples/provenance) | `GET /p/:dfid` — a consumer farm-to-fork page from a public disclosure |
| [`reader`](./examples/reader) | `GET /read/:dfid` — reads a token's content from IPFS + Stellar with **no API key**, re-verifying Ed25519 locally |
| [`notifier`](./examples/notifier) | watches the receipts feed and posts new receipts to a webhook (Slack/Telegram-style) |

## License

MIT.
