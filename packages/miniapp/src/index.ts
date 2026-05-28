import { DefarmSdk } from "@defarm/sdk";
import type { DisclosureRequest, DisclosureResponse, ReceiptSummary } from "@defarm/sdk";

export * from "./types.js";

import { MiniappConfig } from "./types.js";

const DEFAULT_GATEWAY = "https://gateway.defarm.net";

/**
 * DefarmMiniapp wraps `@defarm/sdk` with helpers focused on the shapes a
 * miniapp typically needs: item lookups, typed-event creation with sensible
 * defaults, disclosure creation per audience, and receipt access.
 *
 * The wrapper is intentionally thin. Anything the SDK can do, a miniapp can
 * do directly via `app.sdk`.
 */
export class DefarmMiniapp {
  readonly sdk: DefarmSdk;
  readonly config: Required<Pick<MiniappConfig, "gateway">> & MiniappConfig;

  readonly items: ItemHelpers;
  readonly events: EventHelpers;
  readonly disclosures: DisclosureHelpers;
  readonly receipts: ReceiptHelpers;

  constructor(config: MiniappConfig) {
    if (!config.apiKey && !config.accessToken) {
      throw new Error(
        "DefarmMiniapp requires either `apiKey` (workspace_ingestion key) or `accessToken` (JWT)."
      );
    }
    const gateway = config.gateway ?? DEFAULT_GATEWAY;
    this.config = { ...config, gateway };
    this.sdk = new DefarmSdk({ gatewayBaseUrl: gateway });
    if (config.accessToken) this.sdk.setAccessToken(config.accessToken);
    if (config.apiKey) this.sdk.setApiKey(config.apiKey);

    this.items = new ItemHelpers(this.sdk);
    this.events = new EventHelpers(this.sdk);
    this.disclosures = new DisclosureHelpers(this.sdk);
    this.receipts = new ReceiptHelpers(this.sdk);
  }
}

class ItemHelpers {
  constructor(private sdk: DefarmSdk) {}

  list(params: { circuitId: string }) {
    return this.sdk.items.list(params.circuitId);
  }

  show(id: string) {
    return this.sdk.items.show(id);
  }

  /**
   * Create a BEEF item with a SISBOV canonical identifier through the
   * partner ingestion endpoint. The backend enforces SISBOV format
   * (14-15 digits) and rejects rows that don't carry a trackable identifier.
   */
  createBeefWithSisbov(params: {
    circuitId: string;
    sisbov: string;
    country?: string;
    year?: number;
    metadata?: Record<string, unknown>;
  }) {
    const country = params.country ?? "BR";
    const year = params.year ?? new Date().getUTCFullYear();
    return this.sdk.items.createViaIngestion({
      source_circuit_id: params.circuitId,
      items: [
        {
          value_chain: "BEEF",
          country,
          year,
          metadata: { sisbov: params.sisbov, ...(params.metadata ?? {}) },
        },
      ],
    });
  }
}

class EventHelpers {
  constructor(private sdk: DefarmSdk) {}

  add(params: {
    itemId: string;
    circuitId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }) {
    return this.sdk.events.add({
      item_id: params.itemId,
      circuit_id: params.circuitId,
      event_type: params.eventType,
      payload: params.payload,
    });
  }

  /**
   * Convenience for `item_movement`, which requires `gta_number` in the payload.
   */
  recordMovement(params: {
    itemId: string;
    circuitId: string;
    fromLot: string;
    toLot: string;
    gtaNumber: string;
  }) {
    return this.add({
      itemId: params.itemId,
      circuitId: params.circuitId,
      eventType: "item_movement",
      payload: {
        from_lot: params.fromLot,
        to_lot: params.toLot,
        gta_number: params.gtaNumber,
      },
    });
  }
}

class DisclosureHelpers {
  constructor(private sdk: DefarmSdk) {}

  create(params: DisclosureRequest): Promise<DisclosureResponse> {
    return this.sdk.disclosures.create(params);
  }

  forBank(itemId: string, audience = "bank_partner") {
    return this.create({ item_id: itemId, preset: "finance_basic", audience });
  }

  forAuditor(itemId: string, audience = "certifier") {
    return this.create({ item_id: itemId, preset: "audit_basic", audience });
  }

  forPublic(itemId: string, audience = "public") {
    return this.create({ item_id: itemId, preset: "public_basic", audience });
  }
}

class ReceiptHelpers {
  constructor(private sdk: DefarmSdk) {}

  list(query?: {
    circuit_id?: string;
    item_id?: string;
    receipt_type?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReceiptSummary[]> {
    return this.sdk.receipts.list(query);
  }

  show(id: string) {
    return this.sdk.receipts.show(id);
  }
}
