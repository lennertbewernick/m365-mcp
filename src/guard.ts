// Server-side command guard for m365_run (ADR-001 D2, LBV-1311).
//
// Default is READ-ONLY: commands whose action verb mutates tenant state are
// rejected unless M365_MCP_ALLOW_WRITE=true is set in the server environment.
// Optionally, M365_MCP_COMMAND_ALLOWLIST (comma-separated command prefixes)
// restricts which commands may run at all — it applies in addition to the
// write guard.

/**
 * Action verbs that mutate tenant state. The m365 CLI follows the pattern
 * `m365 <service> <resource> <verb>`, so the verb is the LAST positional
 * token before the first `--option`. Matching is exact on that token —
 * never substring — so e.g. `outlook message list` stays allowed even
 * though a resource name could contain "set".
 */
export const WRITE_VERBS = new Set([
  // minimum set from ADR-001 D2
  "add",
  "set",
  "remove",
  "delete",
  "clear",
  "restore",
  "revoke",
  "disconnect",
  "logout",
  // further mutating verbs the m365 CLI uses
  "login",
  "create",
  "update",
  "send",
  "move",
  "copy",
  "rename",
  "enable",
  "disable",
  "deploy",
  "retract",
  "install",
  "uninstall",
  "upgrade",
  "publish",
  "unpublish",
  "archive",
  "unarchive",
  "recycle",
  "ensure",
  "grant",
  "approve",
  "deny",
  "assign",
  "unassign",
  "cancel",
  "complete",
  "reset",
  "register",
  "unregister",
  "consent",
  "setup",
  "init",
  "sync",
  "transfer",
  "connect",
]);

export interface GuardConfig {
  allowWrite: boolean;
  /** Tokenised allowlist entries; empty array = allowlist disabled. */
  allowlist: string[][];
}

export function guardConfigFromEnv(env: NodeJS.ProcessEnv): GuardConfig {
  const allowlistRaw = env.M365_MCP_COMMAND_ALLOWLIST ?? "";
  return {
    allowWrite: env.M365_MCP_ALLOW_WRITE === "true",
    allowlist: allowlistRaw
      .split(",")
      .map((entry) => entry.trim().replace(/^m365\s+/, ""))
      .filter((entry) => entry.length > 0)
      .map((entry) => entry.split(/\s+/)),
  };
}

/** Positional command-path tokens: everything before the first `-`/`--` option. */
function positionalTokens(args: string[]): string[] {
  const positionals: string[] = [];
  for (const arg of args) {
    if (arg.startsWith("-")) break;
    positionals.push(arg);
  }
  return positionals;
}

/**
 * Checks a parsed m365 command (argument array, no leading "m365") against
 * the guard config. Returns an error message when the command is blocked,
 * or null when it may run.
 */
export function checkCommandAllowed(args: string[], config: GuardConfig): string | null {
  const positionals = positionalTokens(args);
  const commandPath = positionals.join(" ");

  if (config.allowlist.length > 0) {
    const matches = config.allowlist.some(
      (prefix) =>
        prefix.length <= positionals.length &&
        prefix.every((token, i) => token === positionals[i]),
    );
    if (!matches) {
      return (
        `Command blocked: '${commandPath}' does not match M365_MCP_COMMAND_ALLOWLIST ` +
        `(${config.allowlist.map((p) => p.join(" ")).join(", ")}). ` +
        `Adjust the allowlist in the MCP server environment to permit this command.`
      );
    }
  }

  const verb = positionals[positionals.length - 1];
  if (!config.allowWrite && verb !== undefined && WRITE_VERBS.has(verb)) {
    return (
      `Write command blocked: '${commandPath}' — the verb '${verb}' mutates tenant state ` +
      `and m365-mcp runs READ-ONLY by default (ADR-001 D2). ` +
      `Set M365_MCP_ALLOW_WRITE=true in the MCP server environment to enable write commands. ` +
      `Read commands (list, get, show, status, help) are always allowed.`
    );
  }

  return null;
}
