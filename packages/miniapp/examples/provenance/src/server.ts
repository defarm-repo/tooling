/**
 * Consumer provenance viewer (runnable).
 *
 * The farm-to-fork story for a shopper. Put a QR on the product that points at
 * GET /p/:dfid — this app returns a simple public page built from a public_basic
 * disclosure (only the fields meant for the public) plus a link to verify the
 * on-chain anchor without any DeFarm account.
 *
 * GET /p/:dfid        → an HTML page
 * GET /p/:dfid.json   → the same data as JSON
 *
 * Run: npm install && DEFARM_API_KEY=... npm start
 */
import { createServer } from "node:http";
import { DefarmMiniapp, DefarmMiniappError } from "@defarm/miniapp";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
let CIRCUIT_ID = process.env.DEFARM_CIRCUIT_ID ?? "";
const PORT = Number(process.env.PORT ?? 3005);

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

const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );

function page(dfid: string, fields: Record<string, unknown>, verifyUrl: string): string {
  const rows = Object.entries(fields)
    .filter(([k]) => !["audience", "preset", "generated_at"].includes(k))
    .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(typeof v === "object" ? JSON.stringify(v) : v)}</td></tr>`)
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Provenance — ${esc(dfid)}</title>
<style>body{font-family:-apple-system,Arial,sans-serif;max-width:640px;margin:2rem auto;padding:0 1rem;color:#0b1f14}
h1{font-size:1.3rem}.dfid{font-family:monospace;color:#3d5247;font-size:.85rem}
table{border-collapse:collapse;width:100%;margin:1rem 0}td{border-bottom:1px solid #e5e9e7;padding:.5rem .25rem}
td:first-child{color:#6b7f74;text-transform:capitalize;width:40%}
a{color:hsl(145,65%,35%)}.bar{height:6px;background:hsl(145,65%,45%);border-radius:3px;margin-bottom:1rem}</style>
</head><body><div class="bar"></div>
<h1>Where this came from</h1>
<p class="dfid">${esc(dfid)}</p>
<table>${rows || "<tr><td colspan=2>No public fields disclosed.</td></tr>"}</table>
<p><a href="${esc(verifyUrl)}">Verify it yourself on Stellar →</a> (no account needed)</p>
<p style="color:#8fa198;font-size:.8rem">Public provenance via DeFarm. Only fields marked public are shown.</p>
</body></html>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const m = url.pathname.match(/^\/p\/(DFID-[A-Z]+-[A-Z]{2}-\d{4}-\d{6}-[a-f0-9]{6})(\.json)?$/);
  if (!m) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not_found", hint: "GET /p/:dfid or /p/:dfid.json" }));
    return;
  }
  const dfid = m[1];
  const asJson = Boolean(m[2]);

  try {
    const items = await app.items.list({ circuitId: await resolveCircuitId() });
    const item = items.find((i) => i.dfid === dfid);
    if (!item) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "dfid_not_in_circuit", dfid }));
      return;
    }
    const disclosure = await app.disclosures.forPublic(item.id, "consumer");
    const verifyUrl = `${GATEWAY}/v1/verify/${dfid}`;
    const fields = disclosure.disclosed_payload as Record<string, unknown>;

    if (asJson) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ dfid, public_fields: fields, receipt_id: disclosure.receipt_id, verify_yourself: verifyUrl }, null, 2));
    } else {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(page(dfid, fields, verifyUrl));
    }
  } catch (err) {
    const status = err instanceof DefarmMiniappError && err.status ? err.status : 500;
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "upstream_error", message: (err as Error).message }));
  }
});

server.listen(PORT, async () => {
  console.log(`provenance miniapp listening on http://localhost:${PORT}`);
  try {
    const items = await app.items.list({ circuitId: await resolveCircuitId() });
    if (items[0]) {
      console.log(`open: http://localhost:${PORT}/p/${items[0].dfid}`);
      console.log(`json: http://localhost:${PORT}/p/${items[0].dfid}.json`);
    }
  } catch {
    console.log("could not list items — check your DEFARM_API_KEY");
  }
});
