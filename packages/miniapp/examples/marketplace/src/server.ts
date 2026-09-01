/**
 * Marketplace example (runnable).
 *
 * Exposes `GET /listings`: lists items in the circuit, attaches a
 * `finance_basic` disclosure per listed item (audience: "marketplace"),
 * and returns DFID + listing metadata + the disclosure receipt a buyer can
 * verify before settling off-platform.
 *
 * Run: npm install && DEFARM_API_KEY=... npm start
 */
import { createServer } from "node:http";
import { DefarmMiniapp, DefarmMiniappError } from "@defarm/miniapp";
import type { DisclosureResponse } from "@defarm/sdk";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
// Default: the DeFarm sandbox circuit used for reviewer access.
const CIRCUIT_ID =
  process.env.DEFARM_CIRCUIT_ID ?? "aad49a5c-cc5b-4daa-bb95-d969e5765c21";
const PORT = Number(process.env.PORT ?? 3001);
const LISTING_COUNT = 3; // keep the demo footprint small

if (!process.env.DEFARM_API_KEY) {
  console.error("Missing DEFARM_API_KEY. Copy .env.example and set your key:");
  console.error("  DEFARM_API_KEY=... npm start");
  process.exit(1);
}

const app = new DefarmMiniapp({
  gateway: GATEWAY,
  apiKey: process.env.DEFARM_API_KEY,
});

// One disclosure per item per run: cache so repeated requests don't re-issue.
const disclosureCache = new Map<string, DisclosureResponse>();

async function discloseForMarketplace(itemId: string): Promise<DisclosureResponse> {
  const cached = disclosureCache.get(itemId);
  if (cached) return cached;
  const disclosure = await app.disclosures.forBank(itemId, "marketplace");
  disclosureCache.set(itemId, disclosure);
  return disclosure;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  if (url.pathname !== "/listings") {
    send(404, { error: "not_found", hint: "GET /listings" });
    return;
  }

  try {
    const items = await app.items.list({ circuitId: CIRCUIT_ID });
    const beef = items.filter((i) => i.value_chain === "BEEF" && i.status === "active");
    const picked = (beef.length >= LISTING_COUNT ? beef : items).slice(0, LISTING_COUNT);

    const listings = [];
    for (const item of picked) {
      const disclosure = await discloseForMarketplace(item.id);
      const metadata = (item.metadata ?? {}) as Record<string, unknown>;
      listings.push({
        dfid: item.dfid,
        value_chain: item.value_chain,
        country: item.country,
        // Listing metadata comes from the item itself when present.
        weight_kg: metadata["weight_kg"] ?? metadata["peso_kg"] ?? null,
        breed: metadata["breed"] ?? metadata["raca"] ?? null,
        asking_price_brl: metadata["preco_venda"] ?? null,
        provenance: {
          receipt_id: disclosure.receipt_id,
          preset: disclosure.preset,
          proof_hash: disclosure.proof_hash,
        },
        verify_yourself: `${GATEWAY}/v1/verify/${item.dfid}`,
      });
    }

    send(200, {
      circuit_id: CIRCUIT_ID,
      count: listings.length,
      note: "Buyers verify provenance through the disclosure receipt before settling off-platform.",
      listings,
    });
  } catch (err) {
    const status = err instanceof DefarmMiniappError && err.status ? err.status : 500;
    send(status, { error: "upstream_error", message: (err as Error).message });
  }
});

server.listen(PORT, () => {
  console.log(`marketplace miniapp listening on http://localhost:${PORT}`);
  console.log(`try:  curl http://localhost:${PORT}/listings`);
});
