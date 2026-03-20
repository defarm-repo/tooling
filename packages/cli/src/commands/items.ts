import { Command } from "commander";
import { createSdk } from "../sdk.js";
import { circuitLink, itemLink, printJson, shouldUseJson } from "../output.js";

type CliPartnerItem = {
  dfid?: string | null;
  url?: string | null;
  asset_reference?: {
    identifier_type: string;
    value: string;
  } | null;
  matched_existing_item?: boolean | null;
  resolution_result?: string | null;
  merged_fields?: string[];
  routes?: Array<{
    route_type: string;
    route_value: string;
    circuit_id?: string | null;
  }>;
};

type CliPartnerIntakeResponse = {
  summary: {
    items_created: number;
    items_enriched: number;
    warnings?: string[];
  };
  items: CliPartnerItem[];
  errors: Array<{ message: string }>;
};

export function itemsCommands(program: Command) {
  const i = program.command("items").description("Item operations");

  i.command("list").option("--circuit <id>", "Filter by circuit id").option("--json", "Output raw JSON").action(async (opts) => {
    const { sdk, config } = await createSdk();
    const items = await sdk.items.list(opts.circuit);
    if (shouldUseJson(opts)) {
      return printJson(items);
    }
    console.log(`Found ${items.length} item(s)\n`);
    console.table(
      items.map((x) => ({
        id: x.id,
        dfid: x.dfid,
        chain: x.value_chain,
        country: x.country,
        status: x.status,
      })),
    );
    if (items[0]?.id) {
      console.log(`\nOpen first item: ${itemLink(items[0].id, config)}`);
    }
  });

  i.command("show").argument("<id>").option("--json", "Output raw JSON").action(async (id, opts) => {
    const { sdk, config } = await createSdk();
    const item = await sdk.items.show(id);
    if (shouldUseJson(opts)) {
      return printJson(item);
    }
    const shape = item as Record<string, unknown>;
    const current = (shape.item as Record<string, unknown> | undefined) || shape;
    console.log(`Item: ${current.dfid || current.id || id}`);
    console.log(`ID: ${current.id || id}`);
    console.log(`Status: ${current.status || "-"}`);
    console.log(`Open in web: ${itemLink(String(current.id || id), config)}`);
  });

  i
    .command("new")
    .requiredOption("--value-chain <valueChain>")
    .requiredOption("--country <country>")
    .requiredOption("--year <year>")
    .requiredOption("--circuit-id <circuitId>")
    .option("--metadata <json>", "Metadata JSON", "{}")
    .option("--json", "Output raw JSON")
    .action(async (opts) => {
      const { sdk, config } = await createSdk();
      const metadata = JSON.parse(opts.metadata);
      const itemRow = {
        value_chain: String(opts.valueChain).toUpperCase(),
        country: String(opts.country).toUpperCase(),
        year: String(opts.year),
        ...metadata,
      };
      const res = await sdk.http.request<CliPartnerIntakeResponse>("POST", "/v1/partner/ingestions", {
        source_circuit_id: opts.circuitId,
        items: [itemRow],
        fallback_to_source_circuit: true,
        auto_create_circuit: true,
      });
      if (shouldUseJson(opts)) {
        return printJson(res);
      }
      if (res.errors.length > 0 && res.items.length === 0) {
        throw new Error(res.errors[0]?.message || "Ingestion failed");
      }

      const current = res.items[0];
      const resolutionResult =
        current?.resolution_result ||
        (current?.matched_existing_item === true
          ? "enriched"
          : res.summary.items_created > 0 && res.summary.items_enriched === 0
            ? "created"
            : res.summary.items_enriched > 0
              ? "enriched"
              : "created");
      const headline =
        resolutionResult === "enriched"
          ? "Item enriquecido via ingestão"
          : "Item criado via ingestão";
      console.log(headline);
      console.log("");
      if (current?.dfid) {
        console.log(`DFID: ${current.dfid}`);
      }
      if (current?.asset_reference) {
        console.log(
          `Canônico/rastreável: ${current.asset_reference.identifier_type}=${current.asset_reference.value}`,
        );
      }
      if (current?.url) {
        console.log(`Link público: ${current.url}`);
      }
      if (current?.merged_fields?.length) {
        const visibleFields = current.merged_fields.filter(
          (field) => !["value_chain", "country", "year"].includes(field),
        );
        if (visibleFields.length) {
          console.log(
            `${resolutionResult === "enriched" ? "Campos incorporados" : "Campos registrados"}: ${visibleFields.join(", ")}`,
          );
        }
      }
      console.log(`Circuito: ${circuitLink(opts.circuitId, config)}`);
      const primaryRoute = current?.routes?.[0];
      if (primaryRoute?.route_type && primaryRoute?.route_value) {
        console.log(`Rota: ${primaryRoute.route_type}=${primaryRoute.route_value}`);
      }
      if (res.summary.warnings?.length) {
        for (const warning of res.summary.warnings) {
          console.log(`Aviso: ${warning}`);
        }
      }
      console.log("Next: defarm events add --event-type item_weighed --source-type external --source-id <user_uuid> --item-id <item_id> --circuit-id <circuit_id> --payload '{\"weight_kg\":520}'");
    });

  i
    .command("update")
    .argument("<id>")
    .requiredOption("--circuit-id <circuitId>")
    .option("--metadata <json>", "Metadata JSON", "{}")
    .option("--json", "Output raw JSON")
    .action(async (id, opts) => {
      const { sdk, config } = await createSdk();
      const payload = {
        circuit_id: opts.circuitId,
        metadata: JSON.parse(opts.metadata),
      };
      const res = await sdk.items.update(id, payload);
      if (shouldUseJson(opts)) {
        return printJson(res);
      }
      console.log(`Item updated: ${id}`);
      console.log(`Open in web: ${itemLink(id, config)}`);
    });
}
