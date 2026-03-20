import { Command } from "commander";
import { createSdk } from "../sdk.js";
import { circuitLink, printJson, shouldUseJson } from "../output.js";

export function circuitsCommands(program: Command) {
  const c = program.command("circuits").description("Circuit operations");

  c.command("list").option("--json", "Output raw JSON").action(async (opts) => {
    const { sdk, config } = await createSdk();
    const circuits = await sdk.circuits.list();
    if (shouldUseJson(opts)) {
      return printJson(circuits);
    }
    console.log(`Found ${circuits.length} circuit(s)\n`);
    console.table(
      circuits.map((x) => ({
        id: x.id,
        name: x.name,
        visibility: x.visibility || "-",
        type: x.circuit_type || "-",
        status: x.status || "-",
      })),
    );
    if (circuits[0]?.id) {
      console.log(`\nOpen in web: ${circuitLink(circuits[0].id, config)}`);
    }
  });

  c.command("show").argument("<id>").option("--json", "Output raw JSON").action(async (id, opts) => {
    const { sdk, config } = await createSdk();
    const circuit = await sdk.circuits.show(id);
    if (shouldUseJson(opts)) {
      return printJson(circuit);
    }
    console.log(`Circuit: ${circuit.name}`);
    console.log(`ID: ${circuit.id}`);
    console.log(`Visibility: ${circuit.visibility || "-"}`);
    console.log(`Type: ${circuit.circuit_type || "-"}`);
    console.log(`Status: ${circuit.status || "-"}`);
    console.log(`Open in web: ${circuitLink(circuit.id, config)}`);
  });

  c.command("join").argument("<id>").option("-m, --message <message>").option("--json", "Output raw JSON").action(async (id, opts) => {
    const { sdk, config } = await createSdk();
    const res = await sdk.circuits.join(id, opts.message);
    if (shouldUseJson(opts)) {
      return printJson(res);
    }
    console.log("Join request sent successfully.");
    console.log(`Review circuit: ${circuitLink(id, config)}`);
  });

  c.command("members").argument("<id>").option("--json", "Output raw JSON").action(async (id, opts) => {
    const { sdk } = await createSdk();
    const res = await sdk.circuits.members(id);
    if (shouldUseJson(opts)) {
      return printJson(res);
    }
    const members = Array.isArray(res) ? res : (res as { members?: unknown[] }).members || [];
    console.log(`Members: ${members.length}`);
    console.table(
      members.map((m: unknown) => {
        const x = m as Record<string, unknown>;
        return {
          user_id: x.user_id || x.id || "-",
          role: x.role || "-",
          status: x.status || "-",
        };
      }),
    );
  });
}
