import { DefarmHttpClient } from "./client.js";
import {
  AuthResponse,
  Circuit,
  DisclosureRequest,
  DisclosureResponse,
  Event,
  Item,
  PartnerIntakeResponse,
  ReceiptSummary,
} from "./types.js";

export class AuthApi {
  constructor(private readonly http: DefarmHttpClient) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    return this.http.request<AuthResponse>("POST", "/auth/login", { email, password });
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    return this.http.request<AuthResponse>("POST", "/auth/refresh", { refresh_token: refreshToken });
  }

  async whoami(): Promise<AuthResponse["user"]> {
    return this.http.request<AuthResponse["user"]>("GET", "/auth/me");
  }

  async logout(refreshToken?: string): Promise<{ message?: string }> {
    return this.http.request<{ message?: string }>("POST", "/auth/logout", {
      refresh_token: refreshToken,
    });
  }
}

export class WorkspaceApi {
  constructor(private readonly http: DefarmHttpClient) {}

  async list() {
    return this.http.request<{ workspaces: unknown[]; count: number }>("GET", "/auth/workspaces");
  }

  async status() {
    return this.http.request<AuthResponse["user"]>("GET", "/auth/me");
  }
}

export class CircuitsApi {
  constructor(private readonly http: DefarmHttpClient) {}

  async list(): Promise<Circuit[]> {
    const res = await this.http.request<{ circuits?: Circuit[] } | Circuit[]>("GET", "/api/circuits");
    return Array.isArray(res) ? res : res.circuits || [];
  }

  async show(id: string): Promise<Circuit> {
    return this.http.request<Circuit>("GET", `/api/circuits/${id}`);
  }

  async members(id: string) {
    return this.http.request("GET", `/api/circuits/${id}/members`);
  }

  async join(id: string, message?: string) {
    return this.http.request("POST", `/api/circuits/${id}/join-requests`, message ? { message } : {});
  }
}

export class ItemsApi {
  constructor(private readonly http: DefarmHttpClient) {}

  async list(circuitId?: string): Promise<Item[]> {
    const qs = circuitId ? `?circuit_id=${encodeURIComponent(circuitId)}` : "";
    const res = await this.http.request<{ items?: Item[] } | Item[]>("GET", `/api/items${qs}`);
    return Array.isArray(res) ? res : res.items || [];
  }

  async show(id: string) {
    return this.http.request("GET", `/api/items/${id}`);
  }

  async create(payload: Record<string, unknown>) {
    return this.http.request("POST", "/api/items", payload);
  }

  async createViaIngestion(payload: {
    source_circuit_id: string;
    items: Array<Record<string, unknown>>;
    fallback_to_source_circuit?: boolean;
    auto_create_circuit?: boolean;
    mapping?: Record<string, unknown>;
  }): Promise<PartnerIntakeResponse> {
    return this.http.request<PartnerIntakeResponse>("POST", "/v1/partner/ingestions", payload);
  }

  async update(id: string, payload: Record<string, unknown>) {
    return this.http.request("PUT", `/api/items/${id}`, payload);
  }
}

export class EventsApi {
  constructor(private readonly http: DefarmHttpClient) {}

  async list(circuitId?: string): Promise<Event[]> {
    const qs = circuitId ? `?circuit_id=${encodeURIComponent(circuitId)}` : "";
    const res = await this.http.request<{ events?: Event[] } | Event[]>("GET", `/api/events${qs}`);
    return Array.isArray(res) ? res : res.events || [];
  }

  async show(id: string): Promise<Event> {
    return this.http.request<Event>("GET", `/api/events/${id}`);
  }

  async add(payload: Record<string, unknown>) {
    return this.http.request("POST", "/api/events", payload);
  }

  async update(id: string, payload: Record<string, unknown>) {
    return this.http.request("PUT", `/api/events/${id}/status`, payload);
  }
}

export class DisclosuresApi {
  constructor(private readonly http: DefarmHttpClient) {}

  async create(payload: DisclosureRequest): Promise<DisclosureResponse> {
    return this.http.request<DisclosureResponse>("POST", "/api/disclosures", payload);
  }
}

export class ReceiptsApi {
  constructor(private readonly http: DefarmHttpClient) {}

  async list(params?: {
    receipt_type?: string;
    circuit_id?: string;
    item_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReceiptSummary[]> {
    const qs = new URLSearchParams();
    if (params?.receipt_type) qs.set("receipt_type", params.receipt_type);
    if (params?.circuit_id) qs.set("circuit_id", params.circuit_id);
    if (params?.item_id) qs.set("item_id", params.item_id);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await this.http.request<{ receipts?: ReceiptSummary[] } | ReceiptSummary[]>("GET", `/api/receipts${suffix}`);
    return Array.isArray(res) ? res : res.receipts || [];
  }

  async show(id: string) {
    return this.http.request("GET", `/api/receipts/${id}`);
  }
}
