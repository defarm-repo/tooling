import { DefarmSdk } from "@defarm/sdk";
import { loadConfig, loadSession } from "./store.js";

export async function createSdk() {
  const config = await loadConfig();
  const session = await loadSession();
  const sdk = new DefarmSdk({ gatewayBaseUrl: config.gatewayBaseUrl });
  if (session.accessToken) {
    sdk.setAccessToken(session.accessToken);
  }
  if (session.apiKey && "setApiKey" in (sdk as unknown as Record<string, unknown>)) {
    (sdk as unknown as { setApiKey: (apiKey?: string) => void }).setApiKey(session.apiKey);
  }
  return { sdk, config, session };
}
