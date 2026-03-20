import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CliConfig {
  gatewayBaseUrl: string;
  workspaceSlug?: string;
}

export interface CliSession {
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  apiKey?: string;
}

const baseDir = join(homedir(), ".defarm");
const configPath = join(baseDir, "config.json");
const sessionPath = join(baseDir, "session.json");

export async function loadConfig(): Promise<CliConfig> {
  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as CliConfig;
  } catch {
    return { gatewayBaseUrl: "https://gateway.defarm.net" };
  }
}

export async function saveConfig(config: CliConfig): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function loadSession(): Promise<CliSession> {
  try {
    const raw = await readFile(sessionPath, "utf-8");
    return JSON.parse(raw) as CliSession;
  } catch {
    return {};
  }
}

export async function saveSession(session: CliSession): Promise<void> {
  await mkdir(baseDir, { recursive: true });
  await writeFile(sessionPath, JSON.stringify(session, null, 2), "utf-8");
}

export async function resetWorkspaceFiles(): Promise<void> {
  await Promise.allSettled([rm(configPath, { force: true }), rm(sessionPath, { force: true })]);
}
