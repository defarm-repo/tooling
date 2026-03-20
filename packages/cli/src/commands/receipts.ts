import { Command } from "commander";
import { createSdk } from "../sdk.js";
import { printJson, shouldUseJson } from "../output.js";

export function receiptsCommands(program: Command) {
  const r = program.command("receipts").description("Receipts operations");

  r
    .command("list")
    .option("--receipt-type <receiptType>")
    .option("--circuit-id <circuitId>")
    .option("--item-id <itemId>")
    .option("--limit <limit>")
    .option("--offset <offset>")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const { sdk } = await createSdk();
      const res = await sdk.receipts.list({
        receipt_type: opts.receiptType,
        circuit_id: opts.circuitId,
        item_id: opts.itemId,
        limit: opts.limit ? Number(opts.limit) : undefined,
        offset: opts.offset ? Number(opts.offset) : undefined,
      });
      if (shouldUseJson(opts)) {
        return printJson(res);
      }
      console.log(`Found ${res.length} receipt(s)\n`);
      console.table(
        res.map((x) => ({
          id: x.receipt_id,
          type: x.receipt_type,
          status: x.status,
          item_id: x.item_id || "-",
          circuit_id: x.circuit_id || "-",
          created_at: x.created_at,
        })),
      );
    });

  r.command("show").argument("<id>").option("--json", "Output raw JSON").action(async (id, opts) => {
    const { sdk } = await createSdk();
    const res = await sdk.receipts.show(id);
    if (shouldUseJson(opts)) {
      return printJson(res);
    }
    const shape = res as Record<string, unknown>;
    const receipt = (shape.receipt as Record<string, unknown> | undefined) || {};
    console.log(`Receipt: ${receipt.receipt_id || id}`);
    console.log(`Type: ${receipt.receipt_type || "-"}`);
    console.log(`Status: ${receipt.status || "-"}`);
    console.log(`Created: ${receipt.created_at || "-"}`);
  });
}
