/**
 * Sovereign reader (runnable) — read a DeFarm token WITHOUT DeFarm.
 *
 * Every other example in this folder holds a DeFarm API key and asks DeFarm's
 * API for data. This one holds NO key. It shows the deeper claim behind DeFarm:
 * the token and its content live on neutral public infrastructure — Stellar and
 * IPFS — and anyone can read and check them even if DeFarm's servers vanish.
 *
 * Given a DFID, it:
 *   1. resolves the DFID to its IPFS CID + Stellar tx via ONE public, no-auth
 *      call to DeFarm's /verify endpoint (used purely as an index — the "phone
 *      book", not the source of truth);
 *   2. reads the signed snapshot from public IPFS gateways;
 *   3. re-verifies the Ed25519 authorship locally, and checks the signature
 *      actually covers THIS snapshot (not some other document);
 *   4. confirms the anchor transaction on Stellar's own Horizon API;
 *   5. walks the snapshot's previous_cid chain to reconstruct the state history,
 *      entirely from IPFS.
 *
 * What's here vs. not: the snapshot carries verified STATE (weight, breed,
 * birth), aggregate COUNTS, privacy-preserving COMMITMENTS (sisbov/car are
 * HMACs, never the raw number), and an integrity HASH over the events. The raw
 * per-event history (each individual weighing) is NOT on IPFS by design — that's
 * what the key-holding examples fetch from the API. This reader is the public,
 * zero-trust floor.
 *
 * It is also schema-version aware: it reads schema_version and, on a major it
 * doesn't recognise, degrades to raw blocks with a clear note instead of
 * crashing — so a future snapshot shape can't silently break it.
 *
 * GET /read/:dfid
 *
 * Run: npm install && npm start        (no DEFARM_API_KEY needed)
 */
import { createServer } from "node:http";
import { ed25519 } from "@noble/curves/ed25519";

const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
const PORT = Number(process.env.PORT ?? 3007);
const HORIZON = "https://horizon.stellar.org";
// Independent public IPFS gateways; the first to return the bytes wins. The
// content address is the proof, whichever gateway serves it.
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];
// This reader understands the v3 snapshot shape.
const KNOWN_SCHEMA = "defarm.item.snapshot";
const KNOWN_MAJOR = 3;

type Json = Record<string, unknown>;

const b64url = (s: string): Uint8Array => new Uint8Array(Buffer.from(s, "base64url"));

/** Fetch a JSON object for a CID, trying each public gateway in turn. */
async function fetchIpfs(cid: string): Promise<{ json: Json; gateway: string } | null> {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 8000);
      const r = await fetch(`${gw}${cid}`, { signal: c.signal });
      clearTimeout(t);
      if (r.ok) return { json: (await r.json()) as Json, gateway: gw };
    } catch {
      /* try next gateway */
    }
  }
  return null;
}

/**
 * Re-verify the snapshot's Ed25519 signature locally, and confirm it signs THIS
 * snapshot. The signing spec is carried inside the signature block itself:
 *   message = ASCII(domain + "\n") || base64url_decode(signed_document)
 */
function verifyAuthorship(snapshot: Json): Json {
  const sig = (snapshot.signature ?? {}) as Json;
  if (sig.algorithm !== "ed25519" || !sig.value || !sig.public_key || !sig.signed_document) {
    return { verified: false, note: "No Ed25519 signature present on this snapshot." };
  }
  try {
    const domain = String(sig.domain ?? "");
    const signedDoc = b64url(String(sig.signed_document));
    const prefix = new TextEncoder().encode(domain + "\n");
    const message = new Uint8Array(prefix.length + signedDoc.length);
    message.set(prefix, 0);
    message.set(signedDoc, prefix.length);

    const verified = ed25519.verify(b64url(String(sig.value)), message, b64url(String(sig.public_key)));

    // Does the signed document actually describe THIS snapshot? Compare a couple
    // of load-bearing invariants (DFID + the events integrity hash).
    let signsThisSnapshot: boolean | null = null;
    try {
      const doc = JSON.parse(Buffer.from(signedDoc).toString("utf8")) as Json;
      const liveDfid = (snapshot.identity as Json | undefined)?.dfid;
      const liveEventsHash = (snapshot.events as Json | undefined)?.hash;
      const docDfid = (doc.identity as Json | undefined)?.dfid;
      const docEventsHash = (doc.events as Json | undefined)?.hash;
      signsThisSnapshot = docDfid === liveDfid && docEventsHash === liveEventsHash;
    } catch {
      signsThisSnapshot = null;
    }

    return {
      verified,
      signs_this_snapshot: signsThisSnapshot,
      algorithm: "ed25519",
      public_key: sig.public_key,
      signed_at: sig.signed_at,
      spec: sig.spec,
      note: verified
        ? "Signature checked locally against the embedded public key — DeFarm was not asked to vouch for it."
        : "Signature did NOT verify.",
    };
  } catch (e) {
    return { verified: false, note: `Signature check failed: ${(e as Error).message}` };
  }
}

/** Walk provenance.previous_cid backwards, entirely from IPFS. */
async function walkHistory(startCid: string): Promise<Json[]> {
  const history: Json[] = [];
  const seen = new Set<string>();
  let cid: string | null = startCid;
  for (let i = 0; i < 25 && cid && !seen.has(cid); i++) {
    seen.add(cid);
    const got: { json: Json; gateway: string } | null = await fetchIpfs(cid);
    if (!got) {
      history.push({ cid, resolved: false });
      break;
    }
    const prov = (got.json.provenance ?? {}) as Json;
    const sanity = (got.json.sanity ?? {}) as Json;
    history.push({
      cid,
      resolved: true,
      registered_at: prov.registered_at,
      total_events: sanity.total_events,
    });
    cid = (prov.previous_cid as string | null) ?? null;
  }
  return history;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body, null, 2));
  };

  const match = url.pathname.match(/^\/read\/(DFID-[A-Z]+-[A-Z]{2}-\d{4}-\d{6}-[a-f0-9]{6})$/);
  if (!match) {
    send(404, { error: "not_found", hint: "GET /read/:dfid" });
    return;
  }
  const dfid = match[1];

  try {
    // Step 1: the ONLY DeFarm touch — a public, no-auth index lookup DFID -> CID + tx.
    const idxRes = await fetch(`${GATEWAY}/v1/verify/${dfid}`);
    if (idxRes.status === 404) {
      send(404, { error: "dfid_not_found", dfid, note: "No such DFID in DeFarm's public index." });
      return;
    }
    const idx = idxRes.ok ? ((await idxRes.json()) as Json) : null;
    const anchor = (idx?.anchor ?? {}) as Json;
    const freshness = (idx?.content_freshness ?? {}) as Json;
    const cid = anchor.metadata_cid as string | undefined;
    const txHash = anchor.transaction_hash as string | undefined;
    if (!cid) {
      send(200, { dfid, note: "This DFID has no IPFS snapshot anchored yet — nothing to read independently." });
      return;
    }

    // Step 2: read the snapshot from public IPFS (not from DeFarm).
    const got = await fetchIpfs(cid);
    if (!got) {
      send(502, { dfid, cid, error: "ipfs_unresolved", note: "No public IPFS gateway served the snapshot right now." });
      return;
    }
    const snap = got.json;

    // Schema-version awareness: recognise the shape or degrade gracefully.
    const schemaName = String(snap.schema ?? "");
    const schemaVersion = String(snap.schema_version ?? "");
    const major = Number(schemaVersion.split(".")[0]);
    const recognized = schemaName === KNOWN_SCHEMA && major === KNOWN_MAJOR;

    // Step 3: authorship, checked locally.
    const authorship = verifyAuthorship(snap);

    // Step 4: confirm the anchor on Stellar's own Horizon (not DeFarm).
    let horizon: Json = { checked: false };
    if (txHash) {
      try {
        const r = await fetch(`${HORIZON}/transactions/${txHash}`);
        if (r.ok) {
          const tx = (await r.json()) as { successful?: boolean; ledger?: number };
          horizon = { checked: true, confirmed: Boolean(tx.successful), ledger: tx.ledger };
        } else {
          horizon = { checked: true, confirmed: false, status: r.status };
        }
      } catch (e) {
        horizon = { checked: false, error: (e as Error).message };
      }
    }

    // Step 5: reconstruct state history from IPFS alone.
    const history = await walkHistory(cid);

    if (!recognized) {
      send(200, {
        dfid,
        schema: {
          name: schemaName,
          version: schemaVersion,
          recognized: false,
          note: `This reader understands ${KNOWN_SCHEMA} v${KNOWN_MAJOR}. Showing raw blocks; some fields below may be absent or renamed.`,
        },
        sources: sourceNote(cid, got.gateway, txHash),
        raw: snap,
        authorship,
        anchor_on_stellar: horizon,
        history,
      });
      return;
    }

    const identity = (snap.identity ?? {}) as Json;
    const meta = (snap.metadata ?? {}) as Json;
    const sanity = (snap.sanity ?? {}) as Json;
    const property = (snap.property ?? {}) as Json;
    const events = (snap.events ?? {}) as Json;

    send(200, {
      dfid,
      schema: { name: schemaName, version: schemaVersion, recognized: true },
      sources: sourceNote(cid, got.gateway, txHash),
      identity: {
        dfid: identity.dfid,
        value_chain: identity.value_chain,
        country: identity.country,
        year: identity.year,
        status: identity.status,
      },
      state: {
        breed: meta.breed,
        sex: meta.sex,
        birth_date: meta.birth_date,
        weight_kg: meta.weight_kg,
        weighed_at: meta.data_pesagem,
        category: meta.category,
      },
      summary: {
        sealed_at: freshness.latest_content_anchor_confirmed_at ?? null,
        index_flags_newer_events: freshness.stale ?? null,
        note: "Counts and weights are as of sealed_at — when this snapshot was anchored on-chain. If index_flags_newer_events is true, the live API has events created after the seal that aren't in this snapshot yet. That gap is the point: this reader shows what is provably sealed, not what a server claims today.",
        total_events: sanity.total_events,
        weighings: sanity.weighings,
        movements: sanity.movements,
        vaccinations: sanity.vaccinations,
        last_weight_kg: sanity.last_weight_kg,
        last_weight_date: sanity.last_weight_date,
      },
      commitments: {
        note: "Sensitive identifiers are HMAC commitments, never the raw value — you can check equality against a known input, but the number itself is not on IPFS.",
        sisbov: meta.sisbov_commitment,
        car: property.car_commitment,
      },
      events_integrity: {
        note: "A commitment over the raw events, not the events themselves. The per-event detail comes from the API examples in this folder.",
        ...events,
      },
      authorship,
      anchor_on_stellar: horizon,
      history,
      verify_yourself: {
        ipfs: `${IPFS_GATEWAYS[0]}${cid}`,
        stellar: txHash ? `${HORIZON}/transactions/${txHash}` : null,
      },
    });
  } catch (err) {
    send(500, { error: "error", message: (err as Error).message });
  }
});

function sourceNote(cid: string, gateway: string, txHash?: string): Json {
  return {
    defarm_index: `${GATEWAY}/v1/verify/:dfid — public, no auth. Used ONLY to resolve DFID -> CID + tx.`,
    ipfs: `${gateway}${cid} — the content, from a public IPFS gateway.`,
    stellar: txHash ? `${HORIZON}/transactions/${txHash} — the anchor, from Stellar's own API.` : null,
    api_key_used: false,
  };
}

server.listen(PORT, () => {
  console.log(`sovereign reader listening on http://localhost:${PORT}  (no DeFarm API key)`);
  console.log(`try:  curl http://localhost:${PORT}/read/DFID-DEFARM-BR-2026-009474-86b7f8`);
});
