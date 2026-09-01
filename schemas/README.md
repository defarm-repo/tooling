# DeFarm snapshot schemas

Machine-readable JSON Schemas for the **DeFarm item snapshot** — the signed
document that a token's on-chain anchor points to, pinned on IPFS. These let an
independent reader validate a snapshot's shape without trusting DeFarm, and give
the community a stable contract to build on.

## Why this exists

A reader that hardcodes field paths breaks silently when the snapshot shape
changes. The snapshot is already self-describing — it carries `schema`
(`defarm.item.snapshot`) and `schema_version` (e.g. `3.0.0`) — so a reader can
pick the right schema by version and degrade gracefully on an unknown one. This
folder publishes that schema per major version.

## Files

| Path | What |
|------|------|
| [`defarm.item.snapshot/v3.json`](defarm.item.snapshot/v3.json) | JSON Schema (draft 2020-12) for `schema_version` 3.x |
| [`validate.mjs`](validate.mjs) | Validate a snapshot against its published schema |

## Validate a snapshot

```bash
npm install

# Fetch a live token's snapshot (DFID -> CID via public verify -> IPFS) and validate:
node validate.mjs DFID-DEFARM-BR-2026-009474-86b7f8

# Or validate a local snapshot file:
node validate.mjs ./snapshot.json
```

The validator reads the snapshot's own `schema_version` and selects the matching
schema, so it keeps working as new versions ship.

## What the schema captures

- The **required shape** a reader can depend on: `schema`, `schema_version`,
  `identity` (with a well-formed DFID), `provenance` (the `previous_cid` chain),
  the `events` integrity commitment, and the Ed25519 `signature`.
- That sensitive identifiers appear **only as HMAC commitments** (`sisbov_commitment`,
  `car_commitment`), never as raw values.
- That the `events` block is a **commitment over** the events, not the events
  themselves — the raw per-event history comes from the API, not IPFS.

It is intentionally lenient at the object level (additional properties allowed)
so a backward-compatible 3.y minor can add fields without breaking readers.

## Versioning

- One schema per **major** version (`v3.json` validates the whole 3.x line).
- A new major (a breaking shape change) ships a new file (`v4.json`) and the
  validator's `SCHEMA_BY_MAJOR` map gains an entry. Old schemas stay, so old
  anchored snapshots remain verifiable forever.

## Roadmap (not yet done)

- **Pin each schema to IPFS** and reference it from the snapshot via a `$schema`
  CID, so schema discovery doesn't depend on DeFarm's servers being up — the
  same durability the sovereign-reader path already has for the content.
- **Fold this into `@defarm/miniapp`** as a compatibility layer that exposes a
  stable typed view across schema versions, so example authors never bind to raw
  JSON that can shift. See the tracking issue for the full plan.
