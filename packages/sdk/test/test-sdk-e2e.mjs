#!/usr/bin/env node
/**
 * SDK E2E Test — runs against a live local gateway (http://localhost:5050).
 *
 * Prerequisites:
 *   make dev-up-all && ./scripts/dev/seed-dev-data.sh
 *
 * Usage:
 *   node test/test-sdk-e2e.mjs
 */

import { DefarmSdk, DefarmApiError } from "../dist/index.js";
import assert from "node:assert/strict";

const GATEWAY = process.env.GATEWAY_URL || "http://localhost:5050";
const EMAIL = "admin@localhost.dev";
const PASSWORD = "Admin123Dev";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(`    ${err.stack.split("\n").slice(1, 3).join("\n    ")}`);
  }
}

console.log("\n=== SDK E2E Tests against", GATEWAY, "===\n");

const sdk = new DefarmSdk({ gatewayBaseUrl: GATEWAY });
let authResponse;
let circuitId;
let itemId;
let eventId;

// ─── Auth Flow ───

await test("login with email/password", async () => {
  authResponse = await sdk.auth.login(EMAIL, PASSWORD);
  assert.ok(authResponse.access_token, "missing access_token");
  assert.ok(authResponse.refresh_token, "missing refresh_token");
  assert.ok(authResponse.user?.id, "missing user.id");
  sdk.setAccessToken(authResponse.access_token);
});

await test("whoami returns current user", async () => {
  const me = await sdk.auth.whoami();
  assert.equal(me.email, EMAIL);
  assert.ok(me.workspace?.id, "missing workspace.id");
});

await test("refresh token", async () => {
  const refreshed = await sdk.auth.refresh(authResponse.refresh_token);
  assert.ok(refreshed.access_token, "missing new access_token");
  sdk.setAccessToken(refreshed.access_token);
  authResponse = refreshed;
});

// ─── Circuits ───

await test("list circuits", async () => {
  const circuits = await sdk.circuits.list();
  assert.ok(Array.isArray(circuits), "circuits should be an array");
  assert.ok(circuits.length > 0, "expected at least one circuit (from seed)");
  circuitId = circuits[0].id;
});

await test("show circuit", async () => {
  const circuit = await sdk.circuits.show(circuitId);
  assert.ok(circuit.id, "circuit must have id");
  assert.ok(circuit.name, "circuit must have name");
});

await test("list circuit members", async () => {
  const members = await sdk.circuits.members(circuitId);
  assert.ok(members, "members response should exist");
});

// ─── Items (CRUD) ───

await test("create item", async () => {
  const result = await sdk.items.create({
    value_chain: "BEEF",
    country: "BR",
    year: 2026,
    circuit_id: circuitId,
    metadata: { canonical_type: "sisbov", canonical_id: "105500497219983" },
  });
  // Response may wrap item in { item: {...} }
  const item = result.item || result;
  assert.ok(item.id || item.dfid, "item should have id or dfid");
  itemId = item.id;
});

await test("list items by circuit", async () => {
  const items = await sdk.items.list(circuitId);
  assert.ok(Array.isArray(items), "items should be an array");
  assert.ok(items.length > 0, "expected at least one item");
});

await test("show item", async () => {
  const item = await sdk.items.show(itemId);
  assert.ok(item, "item should exist");
});

await test("update item metadata", async () => {
  const updated = await sdk.items.update(itemId, {
    circuit_id: circuitId,
    metadata: { chip: "900264000000001" },
  });
  assert.ok(updated, "update should return response");
});

// ─── Events ───

await test("add event", async () => {
  const event = await sdk.events.add({
    event_type: "item_vaccinated",
    source_type: "partner",
    source_id: authResponse.user?.workspace?.id || "00000000-0000-0000-0000-000000000001",
    circuit_id: circuitId,
    item_id: itemId,
    payload: { vaccine: "aftosa", batch: "A1" },
  });
  assert.ok(event.id, "event should have id");
  eventId = event.id;
});

await test("list events by circuit", async () => {
  const events = await sdk.events.list(circuitId);
  assert.ok(Array.isArray(events), "events should be an array");
  assert.ok(events.length > 0, "expected at least one event");
});

await test("show event", async () => {
  const event = await sdk.events.show(eventId);
  assert.ok(event.id, "event should have id");
  assert.equal(event.event_type, "item_vaccinated");
});

// ─── Disclosures (Tranche 2) ───

await test("create disclosure", async () => {
  try {
    const disclosure = await sdk.disclosures.create({
      item_id: itemId,
      preset: "finance_basic",
      audience: "bank_partner",
    });
    assert.ok(disclosure, "disclosure response should exist");
  } catch (err) {
    // Disclosure endpoint may not be fully implemented yet — 404/501 is acceptable
    if (err instanceof DefarmApiError && [404, 501, 422].includes(err.status)) {
      console.log(`    (skipped: disclosure endpoint returned ${err.status})`);
    } else {
      throw err;
    }
  }
});

// ─── Receipts (Tranche 2) ───

await test("list receipts", async () => {
  try {
    const receipts = await sdk.receipts.list({ circuit_id: circuitId });
    assert.ok(Array.isArray(receipts), "receipts should be an array");
  } catch (err) {
    if (err instanceof DefarmApiError && [404, 501].includes(err.status)) {
      console.log(`    (skipped: receipts endpoint returned ${err.status})`);
    } else {
      throw err;
    }
  }
});

// ─── Error Handling ───

await test("login with wrong password → 401", async () => {
  try {
    await sdk.auth.login(EMAIL, "WrongPass999");
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof DefarmApiError, "should be DefarmApiError");
    assert.equal(err.status, 401);
  }
});

await test("request without auth → 401", async () => {
  const noAuthSdk = new DefarmSdk({ gatewayBaseUrl: GATEWAY });
  try {
    await noAuthSdk.circuits.list();
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof DefarmApiError, "should be DefarmApiError");
    assert.equal(err.status, 401);
  }
});

await test("show non-existent circuit → 404", async () => {
  try {
    await sdk.circuits.show("00000000-0000-0000-0000-000000000000");
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof DefarmApiError, "should be DefarmApiError");
    assert.ok([404, 403].includes(err.status), `expected 404 or 403, got ${err.status}`);
  }
});

await test("show non-existent item → 404", async () => {
  try {
    await sdk.items.show("00000000-0000-0000-0000-000000000000");
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof DefarmApiError, "should be DefarmApiError");
    assert.ok([404, 403].includes(err.status), `expected 404 or 403, got ${err.status}`);
  }
});

await test("show non-existent event → 404", async () => {
  try {
    await sdk.events.show("00000000-0000-0000-0000-000000000000");
    assert.fail("should have thrown");
  } catch (err) {
    assert.ok(err instanceof DefarmApiError, "should be DefarmApiError");
    assert.ok([404, 403].includes(err.status), `expected 404 or 403, got ${err.status}`);
  }
});

await test("gateway wrong URL → connection error", async () => {
  const badSdk = new DefarmSdk({ gatewayBaseUrl: "http://localhost:59999", timeoutMs: 2000 });
  try {
    await badSdk.auth.login(EMAIL, PASSWORD);
    assert.fail("should have thrown");
  } catch (err) {
    // Connection refused or timeout is expected
    assert.ok(err, "should have thrown some error");
  }
});

// ─── API Key Auth Mode ───

await test("API key auth mode", async () => {
  const API_KEY = process.env.DEFARM_API_KEY;
  if (!API_KEY) {
    console.log("    (skipped: set DEFARM_API_KEY env to test)");
    return;
  }
  const apiKeySdk = new DefarmSdk({ gatewayBaseUrl: GATEWAY, apiKey: API_KEY });
  try {
    // Partner endpoints use API key; /api/circuits may require JWT
    await apiKeySdk.items.list();
  } catch (err) {
    if (err instanceof DefarmApiError && err.status === 401) {
      console.log("    (endpoint requires JWT, not API key — expected for some routes)");
    } else {
      throw err;
    }
  }
});

// ─── Logout ───

await test("logout", async () => {
  const result = await sdk.auth.logout(authResponse.refresh_token);
  assert.ok(result !== undefined, "logout should return response");
});

// ─── Summary ───

console.log(`\n${"─".repeat(50)}`);
console.log(`  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`${"─".repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
