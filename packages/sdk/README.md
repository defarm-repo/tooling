# @defarm/sdk

TypeScript SDK for integrating with the DeFarm gateway API.

## Install

```bash
npm install @defarm/sdk
```

## Exemplo

```ts
import { DefarmSdk } from "@defarm/sdk";

const sdk = new DefarmSdk({ gatewayBaseUrl: "https://gateway.defarm.net" });
const auth = await sdk.auth.login("user@example.com", "password");
sdk.setAccessToken(auth.access_token);

const circuits = await sdk.circuits.list();
console.log(circuits);

const disclosure = await sdk.disclosures.create({
  item_id: "<item_id>",
  preset: "finance_basic",
  audience: "bank_partner",
});
console.log(disclosure.receipt_id);

const receipts = await sdk.receipts.list({ receipt_type: "disclosure" });
console.log(receipts.length);
```

## API key authentication

```ts
import { DefarmSdk } from "@defarm/sdk";

const sdk = new DefarmSdk({
  gatewayBaseUrl: "https://gateway.defarm.net",
  apiKey: process.env.DEFARM_API_KEY,
});

const circuits = await sdk.circuits.list();
console.log(circuits);
```

## Testes

```bash
npm test
```

## Publish

```bash
npm publish --access public
```
