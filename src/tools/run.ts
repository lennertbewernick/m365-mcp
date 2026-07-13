import { runM365, formatResult, parseArgs } from "../m365.js";
import { checkCommandAllowed, guardConfigFromEnv } from "../guard.js";

export const runTool = {
  name: "m365_run",
  description:
    "Execute any CLI for Microsoft 365 command and return its parsed JSON output. " +
    "The host must already be authenticated (`m365 login`). " +
    "Pass the command WITHOUT the leading 'm365' and WITHOUT an --output flag — JSON is forced automatically. " +
    "Examples: 'status', 'outlook message list --folderName Inbox --top 10', " +
    "'spo site list', 'teams team list', 'planner plan list --ownerGroupId <id>'. " +
    "Use m365_help first if unsure about a command's arguments. " +
    "The server runs READ-ONLY by default: commands with a mutating verb (add, set, remove, delete, …) " +
    "are rejected unless the server was started with M365_MCP_ALLOW_WRITE=true. " +
    "Destructive operations modify real tenant data — always confirm with the user before invoking.",
  inputSchema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description:
          "The m365 command to execute, without 'm365' prefix and without -o/--output flag. " +
          "Shell operators (|, &&, ;, >) are not allowed — run one command at a time.",
      },
      timeoutMs: {
        type: "number",
        description: "Optional timeout in milliseconds (default 120000).",
      },
    },
    required: ["command"],
    additionalProperties: false,
  },
};

export async function handleRun(args: { command: string; timeoutMs?: number }) {
  const blocked = checkCommandAllowed(parseArgs(args.command), guardConfigFromEnv(process.env));
  if (blocked) {
    return {
      content: [{ type: "text" as const, text: blocked }],
      isError: true,
    };
  }
  const result = await runM365(args.command, { timeoutMs: args.timeoutMs });
  return {
    content: [{ type: "text" as const, text: formatResult(result) }],
    isError: !result.ok,
  };
}
