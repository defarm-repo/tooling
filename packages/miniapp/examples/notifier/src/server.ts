/**
 * Receipts notifier (runnable).
 *
 * The integration shape: watch the receipts feed for a circuit and POST a
 * message to a webhook (Slack, Telegram, your own endpoint) whenever a new
 * receipt lands — a fresh ingestion or a new selective disclosure. This is how
 * a partner wires DeFarm activity into the tools their team already uses.
 *
 * On start it polls immediately, then every POLL_SECONDS. Set WEBHOOK_URL to
 * actually post; without it, notifications are printed to the console (dry-run).
 *
 * Run: npm install && DEFARM_API_KEY=... npm start
 */
import { DefarmMiniapp, DefarmMiniappError } from "@defarm/miniapp";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
let CIRCUIT_ID = process.env.DEFARM_CIRCUIT_ID ?? "";
const WEBHOOK_URL = process.env.WEBHOOK_URL ?? "";
const POLL_SECONDS = Number(process.env.POLL_SECONDS ?? 30);

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

async function notify(text: string): Promise<void> {
  console.log(`[notify] ${text}`);
  if (!WEBHOOK_URL) return;
  try {
    // Slack-compatible shape; most webhooks accept a JSON body with "text".
    await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    console.error(`[notify] webhook post failed: ${(e as Error).message}`);
  }
}

const seen = new Set<string>();

async function poll(): Promise<void> {
  try {
    const cid = await resolveCircuitId();
    const receipts = await app.receipts.list({ circuit_id: cid, limit: 50 });
    // First pass seeds the baseline silently; later passes notify only on new ones.
    const firstRun = seen.size === 0;
    for (const r of receipts) {
      if (seen.has(r.receipt_id)) continue;
      seen.add(r.receipt_id);
      if (!firstRun) {
        await notify(
          `New DeFarm ${r.receipt_type} receipt ${r.receipt_id.slice(0, 8)} ` +
            `(${r.status})${r.item_id ? ` for item ${r.item_id.slice(0, 8)}` : ""}`
        );
      }
    }
    if (firstRun) console.log(`baseline: ${seen.size} existing receipts (will notify on new ones)`);
  } catch (err) {
    const msg = err instanceof DefarmMiniappError ? err.message : (err as Error).message;
    console.error(`[poll] ${msg}`);
  }
}

console.log(`receipts notifier starting — polling every ${POLL_SECONDS}s`);
console.log(WEBHOOK_URL ? `posting to webhook` : `no WEBHOOK_URL set — dry-run (console only)`);
await poll();
setInterval(poll, POLL_SECONDS * 1000);
