import { spawn } from "node:child_process";

export const helpTool = {
  name: "m365_help",
  description:
    "Discover m365 CLI commands and their options. " +
    "Call with no args to see top-level command groups (entra, outlook, teams, spo, planner, flow, pa, …). " +
    "Pass a command path like 'outlook message list' to see flags and examples. " +
    "Use this BEFORE m365_run when you don't know the exact command syntax.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "Optional command path, e.g. 'outlook', 'outlook message list', 'spo site list'. " +
          "Empty string or omitted shows the top-level help.",
      },
    },
    additionalProperties: false,
  },
};

async function runHelp(commandPath: string): Promise<string> {
  return await new Promise<string>((resolve) => {
    const parts = commandPath.trim().split(/\s+/).filter(Boolean);
    const args = [...parts, "--help"];
    const child = spawn("m365", args, { env: process.env });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => (out += c.toString("utf8")));
    child.stderr.on("data", (c) => (err += c.toString("utf8")));
    child.on("error", (e) => resolve(`Failed to invoke m365 --help: ${e.message}`));
    child.on("close", () => resolve(out || err || "(no help output)"));
  });
}

export async function handleHelp(args: { command?: string }) {
  const text = await runHelp(args.command ?? "");
  return {
    content: [{ type: "text" as const, text }],
  };
}
