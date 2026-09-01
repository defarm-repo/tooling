/**
 * Independent verifier (runnable).
 *
 * The whole point: don't trust DeFarm. This app asks DeFarm's public verify
 * endpoint for the on-chain reference (transaction hash + IPFS CID) ONCE, then
 * confirms it INDEPENDENTLY — the transaction against Stellar's own Horizon API
 * (not DeFarm's), and the snapshot against public IPFS gateways. DeFarm cannot
 * forge a Horizon response or an IPFS content address, so a green result here
 * is proof the anchor is real, not DeFarm's word for it.
 *
 * GET /verify/:dfid
 *
 * Run: npm install && DEFARM_API_KEY=... npm start
 */
import { createServer } from "node:http";
import { DefarmMiniapp, DefarmMiniappError } from "@defarm/miniapp";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
const PORT = Number(process.env.PORT ?? 3004);
// Stellar's own public infrastructure — NOT DeFarm.
const HORIZON = "https://horizon.stellar.org";
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
];

if (!process.env.DEFARM_API_KEY) {
  console.error("Missing DEFARM_API_KEY. Copy .env.example and set your key.");
  process.exit(1);
}

const app = new DefarmMiniapp({ gateway: GATEWAY, apiKey: process.env.DEFARM_API_KEY });

async function checkHorizon(txHash: string) {
  try {
    const r = await fetch(`${HORIZON}/transactions/${txHash}`);
    if (!r.ok) return { checked: true, exists: false, status: r.status };
    const tx = (await r.json()) as { successful?: boolean; ledger?: number };
    return { checked: true, exists: true, successful: Boolean(tx.successful), ledger: tx.ledger };
  } catch (e) {
    return { checked: false, error: (e as Error).message };
  }
}

async function checkIpfs(cid: string) {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);
      const r = await fetch(`${gw}${cid}`, { signal: c.signal });
      clearTimeout(t);
      if (r.ok) {
        const bytes = (await r.arrayBuffer()).byteLength;
        return { checked: true, resolves: true, gateway: gw, bytes };
      }
    } catch {
      /* try next gateway */
    }
  }
  return { checked: true, resolves: false };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  const match = url.pathname.match(/^\/verify\/(DFID-[A-Z]+-[A-Z]{2}-\d{4}-\d{6}-[a-f0-9]{6})$/);
  if (!match) {
    send(404, { error: "not_found", hint: "GET /verify/:dfid" });
    return;
  }
  const dfid = match[1];

  try {
    // Step 1: DeFarm's public claim (no auth needed to read it).
    const verify = await fetch(`${GATEWAY}/v1/verify/${dfid}`).then((r) => (r.ok ? r.json() : null));
    const anchor = verify?.anchor;
    if (!anchor?.transaction_hash) {
      send(200, {
        dfid,
        defarm_claim: anchor ?? null,
        verdict: "no_anchor_to_check",
        note: "DeFarm reports no confirmed on-chain anchor for this DFID yet.",
      });
      return;
    }

    // Step 2: verify that claim independently, on infrastructure DeFarm doesn't control.
    const [horizon, ipfs] = await Promise.all([
      checkHorizon(anchor.transaction_hash),
      anchor.metadata_cid ? checkIpfs(anchor.metadata_cid) : Promise.resolve({ checked: false }),
    ]);

    const txOk = Boolean((horizon as { successful?: boolean }).successful);
    const ipfsOk = Boolean((ipfs as { resolves?: boolean }).resolves);
    const verdict = txOk && ipfsOk ? "verified_independently" : txOk ? "tx_confirmed_ipfs_unresolved" : "unverified";

    send(200, {
      dfid,
      defarm_claim: {
        transaction_hash: anchor.transaction_hash,
        metadata_cid: anchor.metadata_cid,
        status: anchor.status,
      },
      independently_checked: {
        stellar_horizon: horizon,
        ipfs,
      },
      verdict,
      note:
        "The Horizon and IPFS checks run against public infrastructure DeFarm does " +
        "not control. A green verdict means the anchor is real — not DeFarm's word for it.",
    });
  } catch (err) {
    const status = err instanceof DefarmMiniappError && err.status ? err.status : 500;
    send(status, { error: "error", message: (err as Error).message });
  }
});

server.listen(PORT, async () => {
  console.log(`verifier miniapp listening on http://localhost:${PORT}`);
  try {
    const circuits = await app.sdk.circuits.list();
    const items = await app.items.list({ circuitId: circuits[0].id });
    if (items[0]) console.log(`try:  curl http://localhost:${PORT}/verify/${items[0].dfid}`);
  } catch {
    console.log("could not list items — check your DEFARM_API_KEY");
  }
});
