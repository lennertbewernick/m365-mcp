import { runM365, formatResult } from "../m365.js";

export const statusTool = {
  name: "m365_status",
  description:
    "Check m365 CLI login status. Returns the currently connected account, tenant, app id and auth type. " +
    "Use this first to confirm authentication before running other commands.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
};

export async function handleStatus() {
  const result = await runM365("status");
  return {
    content: [{ type: "text" as const, text: formatResult(result) }],
    isError: !result.ok,
  };
}
