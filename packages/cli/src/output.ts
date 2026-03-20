export type CliConfigLike = {
  gatewayBaseUrl?: string;
};

export function shouldUseJson(opts: { json?: boolean } | undefined): boolean {
  return Boolean(opts?.json);
}

export function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

export function webAppBaseUrl(config?: CliConfigLike): string {
  const gateway = config?.gatewayBaseUrl || "https://gateway.defarm.net";
  try {
    const url = new URL(gateway);
    if (url.hostname === "gateway.defarm.net") {
      return "https://defarm.net";
    }
    if (url.hostname.startsWith("gateway.")) {
      return `${url.protocol}//${url.hostname.replace(/^gateway\./, "")}`;
    }
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return "https://defarm.net";
  }
}

export function circuitLink(circuitId: string, config?: CliConfigLike): string {
  return `${webAppBaseUrl(config)}/app/circuitos/${circuitId}`;
}

export function itemLink(itemId: string, config?: CliConfigLike): string {
  return `${webAppBaseUrl(config)}/app/itens/${itemId}`;
}
