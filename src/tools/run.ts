import { runM365, formatResult } from "../m365.js";

export const runTool = {
  name: "m365_run",
  description:
    "Execute any CLI for Microsoft 365 command and return its parsed JSON output. " +
    "The host must already be authenticated (`m365 login`). " +
    "Pass the command WITHOUT the leading 'm365' and WITHOUT an --output flag — JSON is forced automatically. " +
    "Examples: 'status', 'outlook message list --folderName Inbox --top 10', " +
    "'spo site list', 'teams team list', 'planner plan list --ownerGroupId <id>'. " +
    "Use m365_help first if unsure about a command's arguments. " +
    "Destructive operations (remove, delete, set, add) modify real tenant data — always confirm with the user before invoking.",
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
  const result = await runM365(args.command, { timeoutMs: args.timeoutMs });
  return {
    content: [{ type: "text" as const, text: formatResult(result) }],
    isError: !result.ok,
  };
}
