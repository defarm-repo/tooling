# @defarm/sdk

SDK TypeScript para integração com a API da DeFarm via gateway.

## Instalação

```bash
npm install @defarm/sdk
```

## Exemplo

```ts
import { DefarmSdk } from "@defarm/sdk";

const sdk = new DefarmSdk({ gatewayBaseUrl: "https://gateway.defarm.net" });
const auth = await sdk.auth.login("email", "senha");
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

## Autenticação por API key (parceiro)

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

## Publicação no npm

```bash
npm publish --access public
```
