#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { authCommands } from "./commands/auth.js";
import { workspaceCommands } from "./commands/workspace.js";
import { circuitsCommands } from "./commands/circuits.js";
import { itemsCommands } from "./commands/items.js";
import { eventsCommands } from "./commands/events.js";
import { disclosuresCommands } from "./commands/disclosures.js";
import { receiptsCommands } from "./commands/receipts.js";
import { notifyIfUpdateAvailable } from "./update-check.js";

const require = createRequire(import.meta.url);
const { version: CLI_VERSION } = require("../package.json") as { version: string };

const program = new Command();
program
  .name("defarm")
  .description("DeFarm CLI")
  .version(CLI_VERSION);

authCommands(program);
workspaceCommands(program);
circuitsCommands(program);
itemsCommands(program);
eventsCommands(program);
disclosuresCommands(program);
receiptsCommands(program);

async function main(): Promise<void> {
  await notifyIfUpdateAvailable(CLI_VERSION);
  await program.parseAsync(process.argv);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`ERROR: ${msg}`);
  process.exit(1);
});
