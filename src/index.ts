#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { runTool, handleRun } from "./tools/run.js";
import { helpTool, handleHelp } from "./tools/help.js";
import { statusTool, handleStatus } from "./tools/status.js";

const server = new Server(
  { name: "m365-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const tools = [runTool, helpTool, statusTool];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: rawArgs } = req.params;
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "m365_run":
        return await handleRun({
          command: String(args.command ?? ""),
          timeoutMs: typeof args.timeoutMs === "number" ? args.timeoutMs : undefined,
        });
      case "m365_help":
        return await handleHelp({
          command: typeof args.command === "string" ? args.command : undefined,
        });
      case "m365_status":
        return await handleStatus();
      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[m365-mcp] fatal:", err);
  process.exit(1);
});
