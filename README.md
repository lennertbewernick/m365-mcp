# m365-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server that wraps the [CLI for Microsoft 365](https://pnp.github.io/cli-microsoft365/). It gives any MCP-aware agent (Claude Code, Claude Desktop, …) authenticated, JSON-typed access to your Microsoft 365 tenant — Outlook, Teams, SharePoint, Planner, Power Automate, Entra, OneDrive, and ~900 other commands.

The server is intentionally thin: it forwards your prompts to the `m365` CLI on the host, forces JSON output, and parses the response. Authentication uses whichever account is logged into `m365 login` on the machine — no extra secrets, no separate OAuth.

## What you get

Three MCP tools:

| Tool          | Purpose                                                                          |
| ------------- | -------------------------------------------------------------------------------- |
| `m365_status` | Show the currently logged-in M365 account, tenant, and auth type.                |
| `m365_help`   | List command groups or get flags for a specific command. Use for discovery.      |
| `m365_run`    | Execute any `m365` command. JSON output is forced; shell operators are blocked.  |

Plus eight ready-made [Claude Code skills](skills/) that teach the model how to use each surface safely:

- `m365-mcp` — overview + auth + safety (load this first)
- `m365-outlook-mail` — inbox triage, search, drafts, send
- `m365-outlook-calendar` — events, agenda, scheduling
- `m365-teams` — chats, channels, messages, members
- `m365-sharepoint-files` — sites, files, sharing
- `m365-sharepoint-lists` — list discovery, items, OData/CAML
- `m365-planner` — plans, buckets, tasks, assignments
- `m365-power-automate` — flows, runs, debugging

## Prerequisites

- **Node.js ≥ 18** (the server is TypeScript / ESM).
- **CLI for Microsoft 365** installed and logged in:
  ```bash
  npm i -g @pnp/cli-microsoft365
  m365 login
  ```
  Follow the browser flow. If you hit `AADSTS7000218`, your Entra app registration needs **Allow public client flows → Yes**.

## Install

### Option A — via `npx` (after publishing)

```bash
npx -y @lennertbewernick/m365-mcp
```

### Option B — from source

```bash
git clone https://github.com/lennertbewernick/m365-mcp.git
cd m365-mcp
npm install
npm run build
```

The built entry point is `dist/index.js`.

## Wire up Claude Code

Add this to your Claude Code MCP config (per-user `~/.claude/.mcp.json` or per-project `.mcp.json`):

```json
{
  "mcpServers": {
    "m365": {
      "command": "node",
      "args": ["/absolute/path/to/m365-mcp/dist/index.js"]
    }
  }
}
```

Or, if installed globally via npm:

```json
{
  "mcpServers": {
    "m365": {
      "command": "npx",
      "args": ["-y", "@lennertbewernick/m365-mcp"]
    }
  }
}
```

Restart Claude Code. The three tools should appear under the `m365` server. Verify with:

> "Check my M365 login status."

That should trigger `m365_status` and surface your connected account.

## Install the skills

The skills/ directory contains eight `SKILL.md` files. To make them available in Claude Code:

```bash
# Symlink the whole skills directory into your Claude Code skills folder
ln -s "$(pwd)/skills"/* ~/.claude/skills/

# Or copy them
cp -r skills/* ~/.claude/skills/
```

Restart Claude Code. Skills auto-load when their trigger phrases match (e.g. "check my Outlook" → `m365-outlook-mail` skill).

## Wire up Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "m365": {
      "command": "node",
      "args": ["/absolute/path/to/m365-mcp/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop. (Skills are Claude-Code-only.)

## Team distribution

Each teammate needs to:

1. Install Node ≥ 18 and the M365 CLI: `npm i -g @pnp/cli-microsoft365`.
2. Log in with their own M365 account: `m365 login`.
3. Install this server (clone + `npm install && npm run build`, or `npx` once published).
4. Add the MCP config to Claude Code / Desktop.
5. Symlink the skills into `~/.claude/skills/`.

Each user runs under **their own M365 permissions** — the MCP server doesn't share tokens between people. The Entra app registration `d61f4bc9-2d02-4965-8a21-edd272b410cf` (the user's "Claude MCP" app, public client) is sufficient if your tenant allows custom app registrations; otherwise the team can use the default PnP CLI app ID by running `m365 setup`.

## Safety notes

- **The CLI can mutate your tenant.** `remove`, `set`, `add`, `send` all hit real data. The skills instruct the model to confirm before destructive calls — but you should treat any `m365_run` output as something to review.
- **Output ends up in the LLM transcript.** Mail bodies, file contents, user lists — all visible to whatever model you're using and stored by your provider. Don't pull more than you need.
- **No shell pipes.** The wrapper rejects `|`, `&&`, `;`, `>` in `m365_run` arguments. If you need to combine commands, call `m365_run` twice and let the model glue the results.
- **Output is capped at 1 MB.** Large list operations should use `--top` / `--pageSize` / `--filter`.

## Development

```bash
npm run dev    # tsc --watch
npm run build  # one-shot build
npm start      # run the built server on stdio (for manual testing)
```

To smoke-test without an MCP client:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"smoke","version":"1.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"m365_status","arguments":{}}}' | node dist/index.js
```

## Roadmap

- [ ] Typed shortcut tools for common patterns (`get_unread_mails`, `find_files`, `today_events`, …)
- [ ] Service-principal auth mode for unattended scenarios
- [ ] Pagination helpers
- [ ] Tests + CI

PRs welcome.

## License

MIT — see [LICENSE](LICENSE).
