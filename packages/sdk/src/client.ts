import { request as undiciRequest } from "undici";
import { DefarmApiError, HttpMethod, SdkConfig } from "./types.js";

export class DefarmHttpClient {
  private readonly config: SdkConfig;
  private accessToken?: string;
  private apiKey?: string;

  constructor(config: SdkConfig) {
    this.config = {
      timeoutMs: 20000,
      ...config,
    };
    this.apiKey = config.apiKey;
  }

  setAccessToken(token?: string) {
    this.accessToken = token;
  }

  setApiKey(apiKey?: string) {
    this.apiKey = apiKey;
  }

  async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<T> {
    const url = `${this.config.gatewayBaseUrl.replace(/\/$/, "")}${path}`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (this.accessToken) {
      headers.authorization = `Bearer ${this.accessToken}`;
    }
    if (this.apiKey) {
      headers["x-api-key"] = this.apiKey;
    }

    const response = await undiciRequest(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      headersTimeout: this.config.timeoutMs,
      bodyTimeout: this.config.timeoutMs,
    });

    const text = await response.body.text();
    const parsed = text ? safeJsonParse(text) : null;

    if (response.statusCode < 200 || response.statusCode >= 300) {
      let message =
        (parsed as any)?.message ||
        (parsed as any)?.error ||
        `HTTP ${response.statusCode} on ${path}`;

      const errorCode = (parsed as any)?.error;
      const requiresBearer =
        response.statusCode === 401 &&
        (errorCode === "missing_token" ||
          String((parsed as any)?.message || "")
            .toLowerCase()
            .includes("bearer token required"));

      if (requiresBearer && this.apiKey && !this.accessToken) {
        message = [
          `Endpoint ${path} requires JWT Bearer authentication.`,
          "Current session is API key mode.",
          "Run: defarm auth login --email <email> --password '<password>'",
        ].join(" ");
      }
      throw new DefarmApiError(message, response.statusCode, parsed);
    }

    return (parsed as T) ?? ({} as T);
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
