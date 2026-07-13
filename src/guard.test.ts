import { test } from "node:test";
import assert from "node:assert/strict";
import { checkCommandAllowed, guardConfigFromEnv } from "./guard.js";
import { parseArgs } from "./m365.js";

const READ_ONLY = guardConfigFromEnv({});
const WRITE_OK = guardConfigFromEnv({ M365_MCP_ALLOW_WRITE: "true" });

function check(command: string, config = READ_ONLY): string | null {
  return checkCommandAllowed(parseArgs(command), config);
}

test("read commands are allowed by default", () => {
  assert.equal(check("status"), null);
  assert.equal(check("outlook message list --folderName Inbox --top 10"), null);
  assert.equal(check("spo site list"), null);
  assert.equal(check("planner task get --id abc"), null);
  assert.equal(check("teams team list"), null);
});

test("write verbs are rejected by default with actionable error", () => {
  for (const cmd of [
    "planner task add --title x",
    "spo site set --url https://x --title y",
    "outlook message remove --id 1",
    "teams team delete --id 1",
    "spo cache clear",
    "spo tenant recyclebinitem restore --siteUrl https://x",
    "entra approleassignment revoke --appId x --resourceId y",
    "logout",
    "disconnect",
  ]) {
    const error = check(cmd);
    assert.ok(error, `expected '${cmd}' to be blocked`);
    assert.match(error!, /M365_MCP_ALLOW_WRITE/, "rejection must name the flag");
  }
});

test("verb match is on the parsed command verb, not substring-in-anywhere", () => {
  // 'add'/'set' appearing inside resource names or option values must not trigger
  assert.equal(check("spo sitedesign list"), null);
  assert.equal(check("outlook message list --searchQuery 'add set delete'"), null);
  // verb is the last positional before options, even with option values after it
  assert.ok(check("spo listitem add --listTitle 'Tasks' --webUrl https://x"));
});

test("M365_MCP_ALLOW_WRITE=true allows write commands", () => {
  assert.equal(check("planner task add --title x", WRITE_OK), null);
  assert.equal(check("teams team delete --id 1", WRITE_OK), null);
  assert.equal(check("status", WRITE_OK), null);
});

test("only the literal 'true' enables writes", () => {
  const notTrue = guardConfigFromEnv({ M365_MCP_ALLOW_WRITE: "1" });
  assert.ok(check("planner task add --title x", notTrue));
});

test("allowlist rejects non-matching commands", () => {
  const config = guardConfigFromEnv({
    M365_MCP_COMMAND_ALLOWLIST: "planner, outlook message list",
    M365_MCP_ALLOW_WRITE: "true",
  });
  assert.equal(check("planner task list", config), null);
  assert.equal(check("planner task add --title x", config), null);
  assert.equal(check("outlook message list --top 5", config), null);
  const blocked = check("spo site list", config);
  assert.ok(blocked);
  assert.match(blocked!, /M365_MCP_COMMAND_ALLOWLIST/);
});

test("allowlist prefixes match whole tokens, not substrings", () => {
  const config = guardConfigFromEnv({ M365_MCP_COMMAND_ALLOWLIST: "outlook message" });
  assert.equal(check("outlook message list", config), null);
  assert.ok(check("outlook messagetrace list", config));
  // entry longer than the command path must not match
  assert.ok(check("outlook", config));
});

test("allowlist applies in addition to the write guard", () => {
  const config = guardConfigFromEnv({ M365_MCP_COMMAND_ALLOWLIST: "planner" });
  // matches allowlist but is still a write without the flag
  const blocked = check("planner task add --title x", config);
  assert.ok(blocked);
  assert.match(blocked!, /M365_MCP_ALLOW_WRITE/);
});
