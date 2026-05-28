export interface MiniappConfig {
  /** Gateway URL. Defaults to https://gateway.defarm.net */
  gateway?: string;
  /** Workspace ingestion API key (recommended for server miniapps). */
  apiKey?: string;
  /** JWT access token (alternative; for user-acting miniapps). */
  accessToken?: string;
}

export class DefarmMiniappError extends Error {
  status?: number;
  cause?: unknown;

  constructor(message: string, status?: number, cause?: unknown) {
    super(message);
    this.name = "DefarmMiniappError";
    this.status = status;
    this.cause = cause;
  }
}
