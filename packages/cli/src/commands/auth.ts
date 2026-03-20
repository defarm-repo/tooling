import { Command } from "commander";
import { createSdk } from "../sdk.js";
import { saveSession } from "../store.js";
import { printJson, shouldUseJson } from "../output.js";

export function authCommands(program: Command) {
  const auth = program.command("auth").description("Authentication commands");

  auth
    .command("login")
    .requiredOption("-e, --email <email>")
    .requiredOption("-p, --password <password>")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const { sdk } = await createSdk();
      const res = await sdk.auth.login(opts.email, opts.password);
      await saveSession({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        email: res.user.email,
        apiKey: undefined,
      });
      if (shouldUseJson(opts)) {
        return printJson(res);
      }
      console.log(`Logged in as ${res.user.email}`);
      console.log(`Workspace: ${res.user.workspace.name} (${res.user.workspace.workspace_type})`);
    });

  auth
    .command("api-key")
    .requiredOption("-k, --key <apiKey>")
    .action(async (opts) => {
      await saveSession({
        apiKey: opts.key,
        accessToken: undefined,
        refreshToken: undefined,
        email: undefined,
      });
      console.log("API key configured for requests");
    });

  auth.command("whoami").option("--json", "Output raw JSON").action(async (opts) => {
    const { sdk } = await createSdk();
    const me = await sdk.auth.whoami();
    if (shouldUseJson(opts)) {
      return printJson(me);
    }
    console.log(`User: ${me.email}`);
    console.log(`Workspace: ${me.workspace.name} (${me.workspace.workspace_type})`);
    console.log(`Role: ${me.workspace.role}`);
  });

  auth.command("refresh").action(async () => {
    const { sdk, session } = await createSdk();
    if (!session.refreshToken) throw new Error("No refresh token in session");
    const res = await sdk.auth.refresh(session.refreshToken);
    await saveSession({
      accessToken: res.access_token,
      refreshToken: res.refresh_token,
      email: res.user.email,
      apiKey: undefined,
    });
    console.log("Token refreshed");
  });

  auth.command("logout").action(async () => {
    const { sdk, session } = await createSdk();
    try {
      await sdk.auth.logout(session.refreshToken);
    } catch {
      // no-op
    }
    await saveSession({});
    console.log("Logged out");
  });
}
