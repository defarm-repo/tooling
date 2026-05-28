import test from "node:test";
import assert from "node:assert";
import { DefarmMiniapp, DefarmMiniappError } from "../dist/index.js";

test("DefarmMiniapp throws when no credentials are provided", () => {
  assert.throws(() => new DefarmMiniapp({}), /requires either `apiKey` .* or `accessToken`/);
});

test("DefarmMiniapp uses the default gateway when none is provided", () => {
  const app = new DefarmMiniapp({ apiKey: "test-key" });
  assert.strictEqual(app.config.gateway, "https://gateway.defarm.net");
  assert.ok(app.items, "items helper attached");
  assert.ok(app.events, "events helper attached");
  assert.ok(app.disclosures, "disclosures helper attached");
  assert.ok(app.receipts, "receipts helper attached");
  assert.ok(app.sdk, "raw sdk exposed as escape hatch");
});

test("DefarmMiniapp accepts an explicit gateway", () => {
  const app = new DefarmMiniapp({ apiKey: "x", gateway: "https://gateway.example.com" });
  assert.strictEqual(app.config.gateway, "https://gateway.example.com");
});

test("DefarmMiniappError exposes status and cause", () => {
  const e = new DefarmMiniappError("nope", 418, { foo: 1 });
  assert.strictEqual(e.status, 418);
  assert.deepStrictEqual(e.cause, { foo: 1 });
  assert.strictEqual(e.name, "DefarmMiniappError");
});
