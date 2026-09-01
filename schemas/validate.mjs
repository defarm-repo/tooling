/**
 * Validate a DeFarm item snapshot against its published JSON Schema.
 *
 * The snapshot is the signed document a token's on-chain anchor points to. This
 * script fetches it the same way an independent reader would — DFID -> CID via
 * the public verify endpoint, then the content from a public IPFS gateway — and
 * checks it against the versioned schema in this folder. It picks the schema by
 * the snapshot's own `schema_version`, so it keeps working as new versions ship.
 *
 * Usage:
 *   node validate.mjs DFID-DEFARM-BR-2026-009474-86b7f8       # fetch + validate
 *   node validate.mjs ./some-snapshot.json                    # validate a local file
 */
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const GATEWAY = process.env.DEFARM_GATEWAY ?? "https://gateway.defarm.net";
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];

const SCHEMA_BY_MAJOR = { "3": "defarm.item.snapshot/v3.json" };

async function fetchIpfs(cid) {
  for (const gw of IPFS_GATEWAYS) {
    try {
      const r = await fetch(`${gw}${cid}`);
      if (r.ok) return r.json();
    } catch {
      /* next gateway */
    }
  }
  throw new Error(`no public IPFS gateway served ${cid}`);
}

async function loadSnapshot(arg) {
  if (arg.startsWith("DFID-")) {
    const v = await fetch(`${GATEWAY}/v1/verify/${arg}`).then((r) => (r.ok ? r.json() : null));
    const cid = v?.anchor?.metadata_cid;
    if (!cid) throw new Error(`no anchored snapshot for ${arg}`);
    return { snapshot: await fetchIpfs(cid), source: cid };
  }
  return { snapshot: JSON.parse(await readFile(arg, "utf8")), source: arg };
}

const arg = process.argv[2];
if (!arg) {
  console.error("usage: node validate.mjs <DFID | path-to-snapshot.json>");
  process.exit(2);
}

const { snapshot, source } = await loadSnapshot(arg);
const major = String(snapshot.schema_version ?? "").split(".")[0];
const schemaFile = SCHEMA_BY_MAJOR[major];
if (!schemaFile) {
  console.error(`No schema published for schema_version ${snapshot.schema_version} (major ${major}).`);
  process.exit(2);
}

const schema = JSON.parse(await readFile(join(HERE, schemaFile), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
const ok = validate(snapshot);

console.log(`snapshot: ${source}`);
console.log(`schema:   ${snapshot.schema} ${snapshot.schema_version} -> ${schemaFile}`);
if (ok) {
  console.log("valid: YES");
} else {
  console.log("valid: NO");
  for (const e of validate.errors ?? []) {
    console.log(`  ${e.instancePath || "(root)"} ${e.message}`);
  }
  process.exit(1);
}
