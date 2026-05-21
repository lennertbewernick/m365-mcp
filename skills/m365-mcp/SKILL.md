---
name: m365-mcp
description: Overview and entry-point for the m365-mcp server. Use this skill whenever a user wants to interact with their Microsoft 365 tenant — read mail, search SharePoint, check Teams chats, manage Planner tasks, list Power Automate flows, or any other M365 admin/data task. Triggers on "Outlook", "Teams", "SharePoint", "Planner", "Power Automate", "M365", "Microsoft 365", "OneDrive", "Entra", "Exchange", or any reference to those products. Always read this skill first before calling the m365_run / m365_help / m365_status tools.
---

# m365-mcp — Microsoft 365 via the CLI

The `m365-mcp` server wraps the [CLI for Microsoft 365](https://pnp.github.io/cli-microsoft365/) so an LLM can drive Outlook, Teams, SharePoint, Planner, Power Automate, Entra, OneDrive and the rest of the tenant. It exposes three tools:

| Tool          | When to use                                                                 |
| ------------- | --------------------------------------------------------------------------- |
| `m365_status` | First call — confirm who is logged in and which tenant is active.           |
| `m365_help`   | Discover commands. Call with no arg for top-level groups, or `outlook message list` for flags. |
| `m365_run`    | Execute a command. Pass everything after `m365 ` (no `-o` flag — JSON is forced). |

## Authentication

The host machine must be logged in once before this server can do anything:

```bash
m365 login
```

Browser-based device flow against `https://login.microsoftonline.com`. The token is cached in `~/.config/cli-microsoft365/` and reused across MCP calls. If you ever see `AADSTS70001` / `not logged in` errors, the user must re-run `m365 login`.

If the connected account doesn't match expectations, call `m365_status` and surface the result — never silently swap accounts.

## Operating principles

1. **Always start with `m365_status`** in a fresh conversation involving M365 data. Confirm the connected account matches the user's expectation.
2. **Use `m365_help` before guessing flags.** The CLI is huge (~900 commands). A 1-second help lookup beats a failed call.
3. **Read-first, write-second.** `list`/`get`/`search` are safe. `add`/`set`/`remove`/`send` mutate real tenant data — confirm with the user *before* invoking, even if they asked for it ("I'll send the mail to X with subject Y — proceed?"). Do not chain destructive calls.
4. **JSON output is automatic.** Don't add `-o json` yourself — the wrapper does it.
5. **Pagination & size:** Most `list` commands accept `--top` (Outlook/Graph) or `--pageSize`/`--pageNumber` (SPO). Default to `--top 25` / `--pageSize 50` and ask the user before pulling huge result sets — output is capped at ~1 MB by the wrapper.
6. **Don't dump PII unnecessarily.** When listing mails/files/users, summarise; only show full content of items the user actually asked about. The transcript is visible to Anthropic and stored client-side.
7. **Time zones:** Outlook event listings need ISO 8601 timestamps and an explicit `--timeZone` to be unambiguous. Default to `Europe/Berlin` for this user unless they say otherwise.

## Domain-specific skills

For deeper guidance on each surface, the following sub-skills exist alongside this one. Their triggers fire automatically based on user intent — you don't need to load them manually, but you can cross-reference them when planning a multi-step workflow:

- [[m365-outlook-mail]] — inbox triage, search, drafts, sending
- [[m365-outlook-calendar]] — events, free/busy, scheduling
- [[m365-teams]] — chats, channels, messages, team membership
- [[m365-sharepoint-files]] — sites, file search, upload/download
- [[m365-sharepoint-lists]] — list discovery, list items, CAML/OData queries
- [[m365-planner]] — plans, buckets, tasks
- [[m365-power-automate]] — flows, runs, enable/disable

## Common pitfalls

- **`spo` commands need `--webUrl`.** Almost every SharePoint command requires the site URL. Get it from `m365 spo site list` first.
- **Outlook user scope.** Without `--userId` / `--userName`, commands act on the connected user. Both flags are required for app-only / cross-user scenarios.
- **Teams chat IDs are ugly.** They look like `19:abc...@thread.v2`. Use `m365 teams chat list` to discover them, never construct them.
- **Bulk operations are slow.** Don't call `m365_run` in a tight loop — each invocation spawns the CLI from scratch (~1 s overhead). Prefer single commands with `--filter` over many individual `get` calls.
- **`flow` and `pa` overlap.** Newer command names live under `flow` (Power Automate); legacy under `pa` (Power Apps). For automation flows, prefer `flow`.

## Example session

```
user: "Lies meine 5 letzten ungelesenen Mails"
→ call m365_status (confirm account)
→ call m365_run with command: outlook message list --folderName Inbox --top 10
→ filter result client-side to isRead == false, show top 5 with from/subject/receivedDateTime
```
