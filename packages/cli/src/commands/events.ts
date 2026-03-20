import { Command } from "commander";
import { createSdk } from "../sdk.js";
import { itemLink, printJson, shouldUseJson } from "../output.js";

export function eventsCommands(program: Command) {
  const e = program.command("events").description("Event operations");

  e.command("list").option("--circuit <id>", "Filter by circuit id").option("--json", "Output raw JSON").action(async (opts) => {
    const { sdk } = await createSdk();
    const events = await sdk.events.list(opts.circuit);
    if (shouldUseJson(opts)) {
      return printJson(events);
    }
    console.log(`Found ${events.length} event(s)\n`);
    console.table(
      events.map((x) => ({
        id: x.id,
        type: x.event_type,
        status: x.status || "-",
        item_id: x.item_id || "-",
        circuit_id: x.circuit_id || "-",
      })),
    );
  });

  e.command("show").argument("<id>").option("--json", "Output raw JSON").action(async (id, opts) => {
    const { sdk } = await createSdk();
    const event = await sdk.events.show(id);
    if (shouldUseJson(opts)) {
      return printJson(event);
    }
    console.log(`Event: ${event.event_type}`);
    console.log(`ID: ${event.id}`);
    console.log(`Status: ${event.status || "-"}`);
    console.log(`Item: ${event.item_id || "-"}`);
    console.log(`Circuit: ${event.circuit_id || "-"}`);
  });

  e
    .command("add")
    .requiredOption("--event-type <eventType>")
    .option("--source-type <sourceType>", "Event source type. Auto set to 'item' when --item-id is provided")
    .option("--source-id <sourceId>", "Event source id. Auto set to --item-id when --item-id is provided")
    .option("--circuit-id <circuitId>")
    .option("--item-id <itemId>")
    .option("--payload <json>", "Payload JSON", "{}")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const { sdk, config } = await createSdk();
      const sourceType = opts.sourceType || (opts.itemId ? "item" : undefined);
      const sourceId = opts.sourceId || opts.itemId;

      if (!sourceType || !sourceId) {
        throw new Error("Missing source fields. Provide --source-type and --source-id, or pass --item-id to auto-fill both.");
      }

      const payload = {
        event_type: opts.eventType,
        source_type: sourceType,
        source_id: sourceId,
        circuit_id: opts.circuitId,
        item_id: opts.itemId,
        payload: JSON.parse(opts.payload),
      };
      const res = await sdk.events.add(payload);
      if (shouldUseJson(opts)) {
        return printJson(res);
      }
      const shape = res as Record<string, unknown>;
      const eventId = String(shape.id || "");
      console.log(`Event created${eventId ? `: ${eventId}` : ""}`);
      if (opts.itemId && !opts.sourceType && !opts.sourceId) {
        console.log("Tip: auto-filled source_type=item and source_id=<item-id>.");
      }
      if (opts.itemId) {
        console.log(`Item page: ${itemLink(opts.itemId, config)}`);
      }
    });

  e
    .command("update")
    .argument("<id>")
    .requiredOption("--status <status>")
    .option("--error-message <message>")
    .option("--json", "Output raw JSON")
    .action(async (id, opts) => {
      const { sdk } = await createSdk();
      const res = await sdk.events.update(id, {
        status: opts.status,
        error_message: opts.errorMessage,
      });
      if (shouldUseJson(opts)) {
        return printJson(res);
      }
      console.log(`Event ${id} updated to status: ${opts.status}`);
    });
}
