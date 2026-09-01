/**
 * Lender credit pre-check (runnable).
 *
 * This is the socket a bank or an investor plugs into: given a DFID, it returns
 * a finance_basic disclosure (the fields a lender is allowed to see) plus a
 * simple, transparent risk signal computed from the animal's VERIFIED history —
 * weight-gain trend and movement/GTA compliance. Nothing here is a credit
 * decision; it's the verifiable input a real underwriting model would consume.
 *
 * GET /credit/:dfid
 *
 * Run: npm install && DEFARM_API_KEY=... npm start
 */
import { createServer } from "node:http";
import { DefarmMiniapp, DefarmMiniappError } from "@defarm/miniapp";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
let CIRCUIT_ID = process.env.DEFARM_CIRCUIT_ID ?? "";
const PORT = Number(process.env.PORT ?? 3003);

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

interface Signals {
  weighings: number;
  gain_kg: number | null;
  avg_daily_gain_kg: number | null;
  monotonic_gain: boolean | null;
  movements: number;
  movements_with_gta: number;
  on_chain_anchor: boolean;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  const match = url.pathname.match(/^\/credit\/(DFID-[A-Z]+-[A-Z]{2}-\d{4}-\d{6}-[a-f0-9]{6})$/);
  if (!match) {
    send(404, { error: "not_found", hint: "GET /credit/:dfid" });
    return;
  }
  const dfid = match[1];

  try {
    const cid = await resolveCircuitId();
    const items = await app.items.list({ circuitId: cid });
    const item = items.find((i) => i.dfid === dfid);
    if (!item) {
      send(404, { error: "dfid_not_in_circuit", dfid });
      return;
    }

    // finance_basic: exactly what a lender is entitled to see.
    const disclosure = await app.disclosures.forBank(item.id, "lender");

    // Verified history → transparent signals.
    const events = await app.sdk.events.list(cid);
    const mine = events.filter((e) => e.item_id === item.id);
    const weighings = mine
      .filter((e) => e.event_type === "item_weighed")
      .map((e) => ({
        kg: Number((e.payload ?? {})["weight_kg"]),
        at: String((e.payload ?? {})["occurred_at"] ?? ""),
      }))
      .filter((w) => Number.isFinite(w.kg))
      .sort((a, b) => a.at.localeCompare(b.at));
    const movements = mine.filter((e) => e.event_type === "item_movement");

    let gainKg: number | null = null;
    let adg: number | null = null;
    // An empty series is vacuously monotonic — but presenting that as a positive
    // signal to a lender is misleading, so with fewer than two weighings it's n/a.
    let monotonic: boolean | null = weighings.length >= 2 ? true : null;
    if (weighings.length >= 2) {
      gainKg = weighings[weighings.length - 1].kg - weighings[0].kg;
      const days =
        (Date.parse(weighings[weighings.length - 1].at) - Date.parse(weighings[0].at)) / 86400000;
      adg = days > 0 ? Math.round((gainKg / days) * 1000) / 1000 : null;
      for (let i = 1; i < weighings.length; i++) {
        if (weighings[i].kg < weighings[i - 1].kg) monotonic = false;
      }
    }

    const anchor = await fetch(`${GATEWAY}/v1/verify/${dfid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => Boolean(b?.anchor?.status === "confirmed"))
      .catch(() => false);

    const signals: Signals = {
      weighings: weighings.length,
      gain_kg: gainKg === null ? null : Math.round(gainKg * 10) / 10,
      avg_daily_gain_kg: adg,
      monotonic_gain: monotonic,
      movements: movements.length,
      movements_with_gta: movements.filter((e) => (e.payload ?? {})["gta_number"]).length,
      on_chain_anchor: anchor,
    };

    // A transparent, non-binding signal. NOT a credit decision.
    const positives =
      Number(signals.weighings >= 2) +
      Number(signals.monotonic_gain === true) +
      Number((signals.avg_daily_gain_kg ?? 0) >= 0.3) +
      Number(signals.on_chain_anchor) +
      Number(signals.movements === signals.movements_with_gta);
    // Without a real weight history there is no basis for a band at all.
    const band =
      signals.weighings < 2 ? "insufficient_data" : positives >= 4 ? "strong" : positives >= 2 ? "fair" : "insufficient_data";

    send(200, {
      dfid,
      risk_signal: {
        band,
        rationale:
          "Transparent, non-binding. Higher when the animal has a verified rising " +
          "weight curve, a confirmed on-chain anchor, and GTA-compliant movements.",
        signals,
      },
      disclosure: {
        receipt_id: disclosure.receipt_id,
        preset: disclosure.preset,
        proof_hash: disclosure.proof_hash,
        disclosed_payload: disclosure.disclosed_payload,
      },
      verify_yourself: `${GATEWAY}/v1/verify/${dfid}`,
      note: "This is the verifiable input to underwriting — not a credit decision.",
    });
  } catch (err) {
    const status = err instanceof DefarmMiniappError && err.status ? err.status : 500;
    send(status, { error: "upstream_error", message: (err as Error).message });
  }
});

server.listen(PORT, async () => {
  console.log(`credit-precheck miniapp listening on http://localhost:${PORT}`);
  try {
    const items = await app.items.list({ circuitId: await resolveCircuitId() });
    const sample = items.find((i) => i.dfid.includes("-DEFARM-")) ?? items[0];
    if (sample) console.log(`try:  curl http://localhost:${PORT}/credit/${sample.dfid}`);
  } catch {
    console.log("could not list items — check your DEFARM_API_KEY");
  }
});
