import { Command } from "commander";
import { createSdk } from "../sdk.js";
import { loadConfig, resetWorkspaceFiles, saveConfig } from "../store.js";
import { printJson, shouldUseJson, webAppBaseUrl } from "../output.js";

export function workspaceCommands(program: Command) {
  const ws = program.command("workspace").description("Workspace commands");

  ws
    .command("init")
    .option("--gateway <url>", "Gateway base URL", "https://gateway.defarm.net")
    .action(async (opts) => {
      await saveConfig({ gatewayBaseUrl: opts.gateway });
      console.log(`Workspace initialized with gateway: ${opts.gateway}`);
    });

  ws.command("status").option("--json", "Output raw JSON").action(async (opts) => {
    const { sdk } = await createSdk();
    const cfg = await loadConfig();
    const me = await sdk.workspace.status();
    const payload = { config: cfg, user: me };
    if (shouldUseJson(opts)) {
      return printJson(payload);
    }
    console.log(`Gateway: ${cfg.gatewayBaseUrl}`);
    console.log(`Web app: ${webAppBaseUrl(cfg)}`);
    console.log(`Workspace: ${me.workspace.name} (${me.workspace.workspace_type})`);
    console.log(`Role: ${me.workspace.role}`);
  });

  ws
    .command("config")
    .option("--gateway <url>", "Gateway base URL")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const current = await loadConfig();
      const next = {
        ...current,
        gatewayBaseUrl: opts.gateway || current.gatewayBaseUrl,
      };
      await saveConfig(next);
      if (shouldUseJson(opts)) {
        return printJson(next);
      }
      console.log(`Gateway configured: ${next.gatewayBaseUrl}`);
      console.log(`Web app: ${webAppBaseUrl(next)}`);
    });

  ws.command("reset").action(async () => {
    await resetWorkspaceFiles();
    console.log("Workspace config/session reset");
  });
}
