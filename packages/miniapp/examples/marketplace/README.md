# Example: marketplace miniapp

Render a public list of DFIDs available for sale from a workspace, with a
finance disclosure attached so a buyer can verify provenance before
settling off-platform.

## What it does

1. Lists items in the configured circuit.
2. For each item with a `price_brl` field in metadata, creates a
   `finance_basic` disclosure with `audience: "marketplace"`.
3. Exposes `GET /listings` returning DFID + price + disclosure receipt id
   + proof hash.

## server.ts

```ts
import { createServer } from "node:http";
import { DefarmMiniapp } from "@defarm/miniapp";

const app = new DefarmMiniapp({
  apiKey: process.env.DEFARM_API_KEY,
});

async function buildListings() {
  const items = await app.items.list({ circuitId: process.env.DEFARM_CIRCUIT_ID });
  const forSale = items.filter((i) => {
    const m = i.metadata as Record<string, unknown> | undefined;
    return m && typeof m.price_brl !== "undefined";
  });

  const listings = await Promise.all(
    forSale.map(async (item) => {
      const disclosure = await app.disclosures.forBank(item.id, "marketplace");
      return {
        dfid: item.dfid,
        price_brl: (item.metadata as Record<string, unknown>).price_brl,
        provenance: {
          receipt_id: disclosure.receipt_id,
          proof_hash: disclosure.proof_hash,
          preset: disclosure.preset,
        },
      };
    })
  );

  return listings;
}

const server = createServer(async (req, res) => {
  if (req.url !== "/listings") {
    res.writeHead(404).end();
    return;
  }
  try {
    const listings = await buildListings();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ listings, generated_at: new Date().toISOString() }));
  } catch (err) {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "miniapp_error", detail: String(err) }));
  }
});

server.listen(Number(process.env.PORT ?? 3031));
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
curl http://localhost:3031/listings | jq
```

## Notes for production

- Cache the disclosures per item (they are stable for the metadata
  snapshot) to avoid creating a new receipt on every request.
- Bind `audience` to the actual buyer identity so the audit trail is
  meaningful.
- The miniapp itself does not move money — it publishes the verifiable
  data buyers need to settle through whatever payment rail you choose.
