import { get } from "node:https";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const PACKAGE_NAME = "@defarm/cli";
const REGISTRY_URL = "https://registry.npmjs.org/@defarm%2fcli/latest";
const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h
const REQUEST_TIMEOUT_MS = 1200;

interface UpdateCache {
  checked_at: number;
  latest_version?: string;
}

function parseSemver(version: string): [number, number, number] {
  const [core] = version.split("-");
  const parts = core.split(".");
  const major = Number.parseInt(parts[0] ?? "0", 10) || 0;
  const minor = Number.parseInt(parts[1] ?? "0", 10) || 0;
  const patch = Number.parseInt(parts[2] ?? "0", 10) || 0;
  return [major, minor, patch];
}

function isNewerVersion(currentVersion: string, latestVersion: string): boolean {
  const [cMaj, cMin, cPatch] = parseSemver(currentVersion);
  const [lMaj, lMin, lPatch] = parseSemver(latestVersion);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}

async function fetchLatestVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const req = get(REGISTRY_URL, { timeout: REQUEST_TIMEOUT_MS }, (res) => {
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }

      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk.toString();
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(raw) as { version?: string };
          resolve(parsed.version ?? null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
  });
}

async function loadCache(cachePath: string): Promise<UpdateCache | null> {
  try {
    const raw = await readFile(cachePath, "utf-8");
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return null;
  }
}

async function saveCache(cachePath: string, cache: UpdateCache): Promise<void> {
  await mkdir(join(homedir(), ".defarm"), { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf-8");
}

export async function notifyIfUpdateAvailable(currentVersion: string): Promise<void> {
  if (process.env.DEFARM_SKIP_UPDATE_CHECK === "1" || process.env.CI === "true") {
    return;
  }

  const cachePath = join(homedir(), ".defarm", "update-check.json");
  const now = Date.now();

  const cache = await loadCache(cachePath);
  if (
    cache?.checked_at &&
    now - cache.checked_at < CHECK_INTERVAL_MS &&
    cache.latest_version &&
    isNewerVersion(currentVersion, cache.latest_version)
  ) {
    printUpdateNotice(cache.latest_version);
    return;
  }

  if (cache?.checked_at && now - cache.checked_at < CHECK_INTERVAL_MS) {
    return;
  }

  const latestVersion = await fetchLatestVersion();
  await saveCache(cachePath, {
    checked_at: now,
    latest_version: latestVersion ?? cache?.latest_version,
  });

  if (latestVersion && isNewerVersion(currentVersion, latestVersion)) {
    printUpdateNotice(latestVersion);
  }
}

function printUpdateNotice(latestVersion: string): void {
  console.error("");
  console.error(`Update available: ${PACKAGE_NAME} -> ${latestVersion}`);
  console.error("Run one of the following commands:");
  console.error("  npx @defarm/cli@latest --help");
  console.error("  npm install -g @defarm/cli@latest");
  console.error("");
}
