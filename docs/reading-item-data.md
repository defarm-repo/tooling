# Reading item data: provenance, visibility & masking

Most of the partner guides describe how data *enters* DeFarm — ingestion,
routing, events. This guide describes how data *comes back out*: what a read of
an item actually returns, why it may differ from what you sent, and who can see
what.

The short version: **a read is never a raw dump of a shared record.** DeFarm
composes each item's data from provenance-scoped contributions and projects only
what the caller is entitled to. This is automatic — you don't opt in, and there
is nothing to configure to get the safe behaviour.

## 1. Metadata is composed, not merged

Historically an item carried one metadata blob that every contributor
overwrote. It no longer works that way. Each contributor's data lives in its own
**attribute layer**, keyed by `(item, source workspace, source circuit)`. When
you read an item, DeFarm **composes** the visible layers into the metadata you
receive:

- Your own workspace's layer is always visible to you (raw).
- Layers explicitly **shared** with a circuit you can read are composed in
  (through their shared projection — see §4).
- Another tenant's **private** layer is never visible to you, and never leaks
  into the composed result.

Practical consequence: two partners can contribute to the same animal without
overwriting each other, and neither can read the other's private contribution by
asserting a shared identifier. The metadata you read describes the **animal**
(breed, weight, category) — it is not a merged map of everyone who ever touched
it.

## 2. Conflicts resolve by the nature of the attribute

When more than one visible layer asserts the same field, DeFarm does not simply
take "the last write". It resolves by what kind of attribute it is:

- **STATE** attributes — a single current truth that changes rarely (breed, sex,
  birth date). Resolved by **trust**: a higher-trust source wins. Trust comes
  from a **versioned, configurable policy** of per-source scores — not a
  hard-coded ranking. The current defaults, highest to lowest: government /
  sanitary authority (85) → certifier (75) → partner-provided data via API key
  (65) → producer (50) → unknown or unrecognised source (35, the floor). An
  unknown-provenance value never overrides a trusted one; and because the scores
  are a policy, they can be retuned without touching your data.
- **SERIES** attributes — values that accumulate over time (weight, movement /
  location, sanitary events). The metadata field is only the **latest** value,
  resolved by **write recency** (the most recently written layer) — a
  denormalisation, so a value backfilled later can appear as "latest" even if it
  occurred earlier. For the true chronology, read the **event stream**:
  `item_weighed` / `item_movement` events, each carrying its own value, domain
  timestamp and provenance.

So a producer can't overwrite a sanitary authority's declared breed (STATE, by
trust); and for series values, trust the event stream over the denormalised field.

## 3. Sensitive identifiers come back masked

Some canonical identifiers are personal or fiscal data. On any read, these are
**masked** to everyone except the workspace that contributed them (and admins):

| Identifier | Non-contributor / public sees |
| --- | --- |
| CPF, CNPJ, inscrição estadual | `•••• 12345` (last 5 digits only) |
| SISBOV, CAR (for LAND items) | full value (deliberate public disclosure) |

The masking is fail-closed: a legacy identifier with unknown provenance is masked
too, until its provenance is backfilled. **If you ingest a CPF/CNPJ, do not
assume you can read it back raw from another workspace** — you read your own
contributions raw, everyone else sees the mask. SISBOV and the CAR of a LAND
parcel stay public on purpose: they are the public identity of the animal /
property, not personal data.

## 4. Visibility: private, shared, public

Every attribute layer has a visibility, and the three levels are distinct —
**`shared` is not `public`**:

- **private** — only the contributing workspace sees it. The default.
- **shared** — eligible to travel to circuits you have an active feed with, *and*
  only the fields allowed by the layer's **shared projection** (wider than public,
  but never PII). A layer is born `shared` only when its source circuit's feed has
  explicitly consented to share attribute layers — sharing the flesh is an opt-in,
  never inferred.
- **public** — projected through a fail-closed **allow-list** (`public_projection`).
  Only allow-listed fields ever reach a public surface; anything not on the list
  is dropped, not exposed.

Sharing is governed by the feed between two circuits: consent is bidirectional
and **revocation is dynamic** — revoke a feed and the shared flesh stops
appearing immediately, while the item itself and its skeleton stay intact. A
field being `shared` is necessary but not sufficient to travel: the live feed is
the authority.

## 5. Public artefacts use commitments, not reversible hashes

When an item is published publicly (IPFS / on-chain), a raw CAR on an **animal**
is never emitted. Instead the public artefact carries a **`car_commitment`** — a
keyed HMAC commitment, structured as `{alg, version, domain, value}`, that proves
stability without revealing the CAR and cannot be reversed. (The old reversible
`car_hash` is gone from new artefacts.) The CAR of a **LAND** item remains public,
because there it is the public identity of the parcel.

## 6. Legacy ("sparse") items

Items created before the layer model exists may have no attribute layer yet. They
read back through a **sanitised legacy fallback** — still allow-listed, never a
raw dump — so a legacy item shows less than a fully-composed one, but never more
than it should. This closes over time as legacy items are reconciled.

## 7. This is automatic — disclosures are the explicit path

Everything above happens on every ordinary read, with no configuration. It is the
*default* privacy posture.

When you instead need to hand a **specific, auditable field-set** to a named third
party — with a signed receipt they can verify — use the separate
[**selective disclosure**](./build-on-defarm.md#5-disclose-selectively) feature
(`disclosures create --preset …`). The two are complementary:

| | Ordinary read | Selective disclosure |
| --- | --- | --- |
| Trigger | Every `GET` | Explicit `disclosures create` |
| Scope | Provenance + visibility of the caller | A chosen preset (`finance_basic`, …) |
| Audience | The authenticated caller | A named audience, with a receipt |
| Sensitive IDs | Masked automatically | Only the preset's fields, by design |

Use ordinary reads for your own operations; use disclosures when a counterparty
needs a verifiable, minimal, purpose-bound extract.

## 8. Inspecting provenance (`?include=provenance`)

By default a read gives you the resolved value of each field, not who asserted it.
When you need to *show* provenance — "this weight came from the sanitary authority,
that location from a partner feed" — opt in:

```
GET /v1/items/{id}?include=provenance
```

The response then carries a `provenance` object keyed by the **same field names** as
`metadata`. Each entry names the contribution that won that field:

```jsonc
{
  "metadata": { "breed": "Nelore", "weight_kg": 452, "current_location_code": "MT-01" },
  "provenance": {
    "breed":                 { "origin": "legacy" },
    "weight_kg":             { "source_workspace_id": "…", "source_circuit_id": "…",
                               "trust_level": "sanitary_agency", "visibility": "private",
                               "via": "own",  "updated_at": "2026-07-01T12:00:00Z" },
    "current_location_code": { "source_workspace_id": "…", "source_circuit_id": "…",
                               "trust_level": "producer", "visibility": "shared",
                               "via": "feed", "updated_at": "2026-06-20T09:00:00Z" }
  }
}
```

- `via` tells you where the value reached you from: `own` (your own layer), `public`,
  or `feed` (a consented feed from another circuit). Resolve `source_workspace_id` to
  a name via the public workspace endpoint rather than showing the raw id.
- `provenance` obeys the **same visibility** as the metadata: its keys are a subset of
  the composed fields, and it never names a layer you aren't already entitled to see.
  A field from the legacy blob reports `{ "origin": "legacy" }`.
- The parameter is opt-in: omit it and the response shape (and cost) is unchanged.

## See also

- [Build on DeFarm](./build-on-defarm.md) — the end-to-end partner flow, including
  selective disclosure (§5).
- Public API reference: <https://docs.defarm.net> — endpoint-level detail.
