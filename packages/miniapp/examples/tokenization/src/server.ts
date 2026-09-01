/**
 * Tokenization example (runnable).
 *
 * Exposes `GET /token/:dfid`: looks the item up in the circuit, creates an
 * `audit_basic` provenance disclosure for it, and attaches the item's public
 * on-chain anchor (Stellar mainnet) fetched from the open verify endpoint.
 * The response is a tokenized representation a downstream financial system
 * could consume: identity + auditable provenance + on-chain reference.
 *
 * Run: npm install && DEFARM_API_KEY=... npm start
 */
import { createServer } from "node:http";
import { DefarmMiniapp, DefarmMiniappError } from "@defarm/miniapp";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
// Default: the DeFarm sandbox circuit used for reviewer access.
const CIRCUIT_ID =
  process.env.DEFARM_CIRCUIT_ID ?? "aad49a5c-cc5b-4daa-bb95-d969e5765c21";
const PORT = Number(process.env.PORT ?? 3000);

if (!process.env.DEFARM_API_KEY) {
  console.error("Missing DEFARM_API_KEY. Copy .env.example and set your key:");
  console.error("  DEFARM_API_KEY=... npm start");
  process.exit(1);
}

const app = new DefarmMiniapp({
  gateway: GATEWAY,
  apiKey: process.env.DEFARM_API_KEY,
});

interface PublicAnchor {
  status?: string;
  transaction_hash?: string;
  explorer_url?: string;
  metadata_cid?: string;
  network?: string;
}

/** The public verify endpoint needs no authentication: anyone can check. */
async function fetchPublicAnchor(dfid: string): Promise<PublicAnchor | null> {
  const res = await fetch(`${GATEWAY}/v1/verify/${dfid}`);
  if (!res.ok) return null;
  const body = (await res.json()) as { anchor?: PublicAnchor };
  return body.anchor ?? null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  const match = url.pathname.match(/^\/token\/(DFID-[A-Z]+-[A-Z]{2}-\d{4}-\d{6}-[a-f0-9]{6})$/);
  if (!match) {
    send(404, {
      error: "not_found",
      hint: "GET /token/:dfid — try the sample DFID printed at startup",
    });
    return;
  }
  const dfid = match[1];

  try {
    const items = await app.items.list({ circuitId: CIRCUIT_ID });
    const item = items.find((i) => i.dfid === dfid);
    if (!item) {
      send(404, { error: "dfid_not_in_circuit", dfid, circuit_id: CIRCUIT_ID });
      return;
    }

    // Auditable provenance for a token consumer (audit_basic preset).
    const disclosure = await app.disclosures.forAuditor(item.id, "token-consumer");
    // Public on-chain anchor — verifiable by anyone, no DeFarm account needed.
    const anchor = await fetchPublicAnchor(dfid);

    send(200, {
      token: {
        dfid: item.dfid,
        value_chain: item.value_chain,
        country: item.country,
        year: item.year,
        status: item.status,
      },
      provenance: {
        receipt_id: disclosure.receipt_id,
        preset: disclosure.preset,
        proof_hash: disclosure.proof_hash,
        disclosed_payload: disclosure.disclosed_payload,
      },
      anchor,
      verify_yourself: `${GATEWAY}/v1/verify/${dfid}`,
    });
  } catch (err) {
    const status = err instanceof DefarmMiniappError && err.status ? err.status : 500;
    send(status, { error: "upstream_error", message: (err as Error).message });
  }
});

server.listen(PORT, async () => {
  console.log(`tokenization miniapp listening on http://localhost:${PORT}`);
  try {
    const items = await app.items.list({ circuitId: CIRCUIT_ID });
    const sample = items.find((i) => i.dfid.includes("-BEEF-")) ?? items[0];
    if (sample) {
      console.log(`try:  curl http://localhost:${PORT}/token/${sample.dfid}`);
    }
  } catch {
    console.log("could not list items yet — check your DEFARM_API_KEY");
  }
});
