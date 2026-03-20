import { Command } from "commander";
import { createSdk } from "../sdk.js";
import { itemLink, printJson, shouldUseJson } from "../output.js";

export function disclosuresCommands(program: Command) {
  const d = program.command("disclosures").description("Selective disclosure operations");

  d
    .command("create")
    .requiredOption("--item-id <itemId>")
    .requiredOption("--preset <preset>")
    .option("--audience <audience>")
    .option("--expires-in-days <days>")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const { sdk, config } = await createSdk();
      const res = await sdk.disclosures.create({
        item_id: opts.itemId,
        preset: opts.preset,
        audience: opts.audience,
        expires_in_days: opts.expiresInDays ? Number(opts.expiresInDays) : undefined,
      });
      if (shouldUseJson(opts)) {
        return printJson(res);
      }
      console.log(`Disclosure created: ${res.receipt_id}`);
      console.log(`Preset: ${res.preset}`);
      console.log(`Proof hash: ${res.proof_hash}`);
      console.log(`Item page: ${itemLink(opts.itemId, config)}`);
      console.log(`Next: defarm receipts show ${res.receipt_id}`);
    });
}
