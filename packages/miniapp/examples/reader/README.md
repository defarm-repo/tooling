# Sovereign reader

Read a DeFarm token's verified content straight from **public IPFS and Stellar**,
with **no DeFarm API key**. This is the "don't trust DeFarm" idea taken all the
way: not just checking that an anchor exists, but reading and verifying the
token's content from neutral infrastructure that DeFarm doesn't control — so it
keeps working even if DeFarm's servers go away.

Every other example in this folder holds an API key and asks DeFarm's API for
data. This one holds none.

## What it does

Given a DFID, `GET /read/:dfid`:

1. resolves the DFID to its IPFS CID and Stellar transaction with **one public,
   no-auth call** to DeFarm's `/verify` endpoint — used purely as an index (the
   phone book), not as the source of truth;
2. reads the signed snapshot from **public IPFS gateways**;
3. **re-verifies the Ed25519 authorship locally** and checks the signature
   actually covers *this* snapshot (not some other document) — DeFarm is never
   asked to vouch for it;
4. confirms the anchor transaction on **Stellar's own Horizon API**;
5. **walks the `previous_cid` chain** to reconstruct the state history, entirely
   from IPFS.

## What's on IPFS, and what isn't

The snapshot carries verified **state** (weight, breed, birth date), aggregate
**counts**, privacy-preserving **commitments** (SISBOV and CAR are HMACs — you
can check equality against a known value, but the raw number is never on IPFS),
and an integrity **hash** over the events. The raw per-event history — each
individual weighing, each movement — is deliberately *not* on IPFS; that's what
the key-holding examples (`partnership`, `credit-precheck`) fetch from the API.

This reader is the public, zero-trust floor. The API examples build on top of it.

## A point in time, on purpose

The numbers here come from the **anchored snapshot** — a photograph taken when
the token was last sealed on-chain (see `summary.sealed_at`, and
`summary.index_flags_newer_events` when the live API has moved ahead). If you run
`partnership` or `credit-precheck` (which read the *live* API) and this reader
side by side, the reader may show fewer events: those examples see what exists
today, this one sees what was cryptographically sealed. That gap isn't a bug —
it's the whole demonstration. Immutability has a cost: what's sealed is what was
sealed, until the next re-anchoring. A server can change its mind; a sealed
snapshot can't.

## Schema awareness

The snapshot is self-describing (`schema` + `schema_version`). This reader is
built for `defarm.item.snapshot` v3 and, on a major version it doesn't
recognise, degrades to returning the raw blocks with a clear note instead of
crashing — so a future snapshot shape can't silently break it.

## Run

```bash
npm install
npm start          # no DEFARM_API_KEY needed
```

Then:

```bash
curl http://localhost:3007/read/DFID-DEFARM-BR-2026-009474-86b7f8
```

You'll get the identity, current state, event summary, commitments, the local
Ed25519 verdict, the Horizon confirmation, and the IPFS state history — plus a
`verify_yourself` block with the raw IPFS and Stellar URLs so you can repeat
every check by hand.

## Config

`.env` is optional. `DEFARM_GATEWAY` (default `https://gateway.defarm.net`) is
the only DeFarm endpoint used, and only to turn a DFID into a CID. `PORT`
defaults to `3007`.
