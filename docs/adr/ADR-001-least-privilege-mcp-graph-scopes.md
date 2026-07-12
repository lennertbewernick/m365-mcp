# ADR-001: Least-privilege strategy for m365-mcp and microsoft-planner-mcp

**Status:** Accepted
**Date:** 2026-07-12
**Issue:** LBV-1309 (from Fable-5 audit LBV-1300, finding F3; parent LBV-1266)
**Scope:** `~/dev/m365-mcp`, `~/microsoft-planner-mcp`

## Context

Both MCP servers hold no tokens themselves — they delegate auth to a host CLI. That
architecture is correct and stays. The problem (audit F3, MEDIUM) is *which* identity
they inherit:

- **microsoft-planner-mcp** calls Graph via `az rest`, i.e. with the **Azure CLI
  first-party app** token. That app carries very broad delegated Graph permissions —
  far beyond the Planner/Tasks surface the server actually uses.
- **m365-mcp** already authenticates through a **dedicated Entra app registration**
  (`d61f4bc9-2d02-4965-8a21-edd272b410cf`, CLI for Microsoft 365 custom app,
  signed in as lb@justclose.de). Its transport (spawn without shell + shell-quote,
  shell operators rejected) is the reference pattern. The remaining gap is that
  `m365_run` accepts **any** command, including destructive `remove/delete/set`,
  with no server-side guard — only a model-side "confirm with user" hint.

## Decision

### D1 — planner-mcp drops the Azure CLI first-party token; reuse the existing dedicated app

microsoft-planner-mcp will obtain its Graph token from the **CLI for Microsoft 365**
(`m365 util accesstoken get --resource https://graph.microsoft.com`, invoked via
`execFileSync`, no shell) instead of the Azure CLI. Rationale:

- The dedicated app registration **already exists** and is already the trusted auth
  path for m365-mcp. One app, one documented scope set, one consent surface — better
  than a second registration to provision, rotate, and audit.
- Azure CLI (`az`) cannot be pinned to a custom app for delegated auth; staying on
  `az` means staying on the first-party app's full scope forever.
- App-only auth (client secret / service principal) was rejected: it would put a
  secret on disk and require *tenant-wide* application permissions
  (`Tasks.ReadWrite.All` etc.) — a larger blast radius than delegated scopes, not
  smaller.

The app's delegated Graph scopes must cover exactly the planner-mcp tool surface and
nothing more:

| Scope | Needed by |
|---|---|
| `Tasks.ReadWrite` | all plan/bucket/task/checklist CRUD tools |
| `Group.ReadWrite.All` | `add-task-comment` / `list-task-comments` (group thread posts) |
| `User.ReadBasic.All` | `find-user` |

`Group.ReadWrite.All` is the one broad scope, needed only by the two comment tools
and requiring admin consent. If the board prefers not to grant it, the fallback is to
drop those two tools; that choice is surfaced during provisioning (child issue).

Existing scopes on the app that m365-mcp genuinely uses are kept; anything unused is
removed during the same provisioning pass.

### D2 — m365_run becomes read-only by default, writes gated by env flag

`m365-mcp` gets a server-side guard, not just a prompt hint:

- **Default: read-only.** Commands whose action verb is destructive/mutating
  (`add`, `set`, `remove`, `delete`, `clear`, `restore`, `revoke`, `disconnect`,
  `logout`, and similar) are rejected unless `M365_MCP_ALLOW_WRITE=true` is set in
  the server's environment.
- Optional stricter mode: `M365_MCP_COMMAND_ALLOWLIST` (comma-separated command
  prefixes, e.g. `planner,outlook message list`) rejects anything not matching.
- The rollout must inventory existing MCP client registrations and set
  `M365_MCP_ALLOW_WRITE=true` explicitly where write flows exist today, so the
  default flip does not silently break them.

### D3 — F5 documented as a constraint (this ADR is the record)

`m365-mcp` passes `env: process.env` to `spawn`. This is required (MSAL token-cache
paths) and safe **only because the child is spawned without a shell**. Constraint for
all future changes to `src/m365.ts` and to planner-mcp's transport:

> Never switch the child-process invocation to a shell (`exec`, `execSync`,
> `shell: true`). The full-environment pass-through plus a shell would turn any
> argument-injection bug into environment-assisted command execution. Use
> `spawn`/`execFile` variants with argument arrays only.

## Consequences

- Azure CLI login stops being a dependency of planner-mcp; `az` remains for actual
  Azure management only.
- Sequencing: the planner-mcp token switch touches the same functions as the
  LBV-1308 injection fix (`azRest`/`azRestWithIfMatch`) and therefore lands **after**
  LBV-1308 and after the app scopes are provisioned.
- Scope changes on the shared app require admin consent by the tenant admin
  (Lennert) — a one-time interactive step per scope change.

## Implementation

- LBV-1310 (DevOps): provision/verify delegated scopes on app `d61f4bc9…`, admin consent, document final scope set here.
- LBV-1311 (SE): m365-mcp read-only default + write flag + allowlist; client-config inventory; F5 note in README.
- LBV-1312 (SE): planner-mcp token source switch to `m365 util accesstoken get` (blocked by LBV-1308 + LBV-1310).

(Issue numbers recorded at creation time; see LBV-1309 for the authoritative links.)
