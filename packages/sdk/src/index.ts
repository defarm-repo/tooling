import { DefarmHttpClient } from "./client.js";
import { AuthApi, CircuitsApi, DisclosuresApi, EventsApi, ItemsApi, ReceiptsApi, WorkspaceApi } from "./modules.js";
import { SdkConfig } from "./types.js";

export * from "./types.js";

export class DefarmSdk {
  readonly auth: AuthApi;
  readonly workspace: WorkspaceApi;
  readonly circuits: CircuitsApi;
  readonly items: ItemsApi;
  readonly events: EventsApi;
  readonly disclosures: DisclosuresApi;
  readonly receipts: ReceiptsApi;
  readonly http: DefarmHttpClient;

  constructor(config: SdkConfig) {
    this.http = new DefarmHttpClient(config);
    this.auth = new AuthApi(this.http);
    this.workspace = new WorkspaceApi(this.http);
    this.circuits = new CircuitsApi(this.http);
    this.items = new ItemsApi(this.http);
    this.events = new EventsApi(this.http);
    this.disclosures = new DisclosuresApi(this.http);
    this.receipts = new ReceiptsApi(this.http);
  }

  setAccessToken(token?: string) {
    this.http.setAccessToken(token);
  }

  setApiKey(apiKey?: string) {
    this.http.setApiKey(apiKey);
  }
}
