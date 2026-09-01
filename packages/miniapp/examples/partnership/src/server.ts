/**
 * Livestock partnership tracker (runnable).
 *
 * In Brazilian cattle raising, a very common arrangement is the "parceria
 * pecuaria": one party (the investor) brings the animal at an entry weight,
 * another (the rancher) raises it, and at the end they split the WEIGHT GAINED.
 * Today this runs on trust, paper and WhatsApp. This miniapp reads the animal's
 * verified weighing history from DeFarm and computes the split — every number
 * backed by a typed, anchored event instead of a spreadsheet.
 *
 * GET /partnership/:dfid?split=0.5
 *   split = the rancher's share of the GAIN (default 0.5). The investor always
 *   gets their entry-weight capital back; the gain is what gets divided.
 *
 * Run: npm install && DEFARM_API_KEY=... npm start
 */
import { createServer } from "node:http";
import { DefarmMiniapp, DefarmMiniappError } from "@defarm/miniapp";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
let CIRCUIT_ID = process.env.DEFARM_CIRCUIT_ID ?? "";
const PORT = Number(process.env.PORT ?? 3002);
const ARROBA_KG = 15; // 1 arroba = 15 kg of carcass (the market unit)

if (!process.env.DEFARM_API_KEY) {
  console.error("Missing DEFARM_API_KEY. Copy .env.example and set your key.");
  process.exit(1);
}

const app = new DefarmMiniapp({ gateway: GATEWAY, apiKey: process.env.DEFARM_API_KEY });

async function resolveCircuitId(): Promise<string> {
  if (CIRCUIT_ID) return CIRCUIT_ID;
  const circuits = await app.sdk.circuits.list();
  if (circuits.length === 0) throw new Error("This API key sees no circuits. Set DEFARM_CIRCUIT_ID.");
  CIRCUIT_ID = circuits[0].id;
  console.log(`circuit auto-discovered from key: ${circuits[0].name} (${CIRCUIT_ID})`);
  return CIRCUIT_ID;
}

interface Weighing {
  weight_kg: number;
  occurred_at: string;
}

/** Pull the verified weighing history (typed events) for one item in the circuit. */
async function weighings(itemId: string): Promise<Weighing[]> {
  const events = await app.sdk.events.list(await resolveCircuitId());
  return events
    .filter((e) => e.item_id === itemId && e.event_type === "item_weighed")
    .map((e) => ({
      weight_kg: Number((e.payload ?? {})["weight_kg"]),
      occurred_at: String((e.payload ?? {})["occurred_at"] ?? ""),
    }))
    .filter((w) => Number.isFinite(w.weight_kg))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  const match = url.pathname.match(/^\/partnership\/(DFID-[A-Z]+-[A-Z]{2}-\d{4}-\d{6}-[a-f0-9]{6})$/);
  if (!match) {
    send(404, { error: "not_found", hint: "GET /partnership/:dfid?split=0.5" });
    return;
  }
  const dfid = match[1];
  const rancherShare = Math.min(Math.max(Number(url.searchParams.get("split") ?? 0.5), 0), 1);

  try {
    const items = await app.items.list({ circuitId: await resolveCircuitId() });
    const item = items.find((i) => i.dfid === dfid);
    if (!item) {
      send(404, { error: "dfid_not_in_circuit", dfid });
      return;
    }

    const ws = await weighings(item.id);
    if (ws.length < 2) {
      send(200, {
        dfid,
        note: "Need at least two verified weighings to compute a partnership split.",
        weighings: ws,
      });
      return;
    }

    const entry = ws[0];
    const current = ws[ws.length - 1];
    const gainKg = current.weight_kg - entry.weight_kg;
    const rancherKg = Math.round(gainKg * rancherShare * 10) / 10;
    const investorKg = Math.round((entry.weight_kg + gainKg * (1 - rancherShare)) * 10) / 10;

    send(200, {
      dfid,
      partnership: {
        entry_weight_kg: entry.weight_kg,
        entry_date: entry.occurred_at,
        current_weight_kg: current.weight_kg,
        current_date: current.occurred_at,
        gain_kg: Math.round(gainKg * 10) / 10,
        gain_arrobas: Math.round((gainKg / ARROBA_KG) * 10) / 10,
        rancher_share: rancherShare,
        settlement: {
          investor_gets_kg: investorKg,
          investor_note: "entry-weight capital returned + investor share of the gain",
          rancher_gets_kg: rancherKg,
          rancher_note: "rancher share of the gain",
        },
      },
      weighings: ws,
      verify_yourself: `${GATEWAY}/v1/verify/${dfid}`,
      note: "Every weight is a typed, anchored event — verifiable, not a spreadsheet.",
    });
  } catch (err) {
    const status = err instanceof DefarmMiniappError && err.status ? err.status : 500;
    send(status, { error: "upstream_error", message: (err as Error).message });
  }
});

server.listen(PORT, async () => {
  console.log(`partnership miniapp listening on http://localhost:${PORT}`);
  try {
    const items = await app.items.list({ circuitId: await resolveCircuitId() });
    for (const it of items) {
      const ws = await weighings(it.id);
      if (ws.length >= 2) {
        console.log(`try:  curl "http://localhost:${PORT}/partnership/${it.dfid}?split=0.5"`);
        return;
      }
    }
    console.log("no item with 2+ weighings yet — any DFID still returns its (empty) history");
  } catch {
    console.log("could not list items — check your DEFARM_API_KEY");
  }
});
