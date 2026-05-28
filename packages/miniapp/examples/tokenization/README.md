# Example: tokenization miniapp

Turn a verified BEEF item into a tokenized representation usable by
downstream financial systems. The miniapp exposes a single endpoint
`GET /token/:dfid` that returns the item, a provenance disclosure
(`audit_basic` preset) and the on-chain anchor reference.

## Files

- `server.ts` — minimal HTTP server using `@defarm/miniapp`.
- `package.json` — depends on `@defarm/miniapp` and any HTTP server you prefer
  (the snippet uses Node's built-in `node:http`).

## server.ts

```ts
import { createServer } from "node:http";
import { DefarmMiniapp } from "@defarm/miniapp";

const app = new DefarmMiniapp({
  apiKey: process.env.DEFARM_API_KEY,
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/token\/(DFID-[A-Z]+-[A-Z]{2}-\d{4}-\d{6}-[a-f0-9]{6})$/);

  if (!match) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  try {
    const items = await app.items.list({ circuitId: process.env.DEFARM_CIRCUIT_ID });
    const item = items.find((i) => i.dfid === match[1]);

    if (!item) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "dfid_not_in_circuit" }));
      return;
    }

    const disclosure = await app.disclosures.forAuditor(item.id, "tokenization-miniapp");

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        dfid: item.dfid,
        item,
        provenance: {
          receipt_id: disclosure.receipt_id,
          proof_hash: disclosure.proof_hash,
          disclosed_payload: disclosure.disclosed_payload,
        },
      })
    );
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "miniapp_error", detail: String(err) }));
  }
});

server.listen(Number(process.env.PORT ?? 3030));
```

## Run

```bash
export DEFARM_API_KEY="<your partner key>"
export DEFARM_CIRCUIT_ID="<your circuit id>"
npm install
node --import tsx server.ts
```

Then:

```bash
curl http://localhost:3030/token/DFID-BEEF-BR-2026-000084-78422b | jq
```

Expected response carries the item plus a freshly minted provenance receipt
that downstream systems can verify on-chain.
