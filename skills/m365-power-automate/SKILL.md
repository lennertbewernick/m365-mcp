---
name: m365-power-automate
description: List, inspect, enable/disable and manage Power Automate flows via m365-mcp. Use when the user asks about Power Automate, "my flows", "is the flow running", "why did the flow fail", "disable the flow", "list runs", "export this flow", or anything about Microsoft Flow / Power Automate. Read [[m365-mcp]] first.
---

# Power Automate via m365-mcp

Power Automate flows live under the `flow` command group. Power Apps (canvas/model-driven) lives under `pa` — different product, don't mix them up.

Subgroups: `flow environment`, `flow` (top-level CRUD), `flow run`, `flow owner`, `flow connector`, `flow recyclebinitem`.

## Environments

Everything in Power Platform is scoped to an environment. List them first:

```
flow environment list
flow environment get --name <envGuid>
```

Most tenants have a "Default" environment (`displayName: "Default"`); the GUID is what you pass to all other commands. There's no `--environment "Default"` shortcut — resolve the GUID first.

## Listing flows

```
flow list --environmentName <envGuid>
flow list --environmentName <envGuid> --asAdmin            # admin view of all flows
flow get  --name <flowGuid> --environmentName <envGuid>
```

Returned per flow: `name` (guid), `displayName`, `state` (`Started` / `Stopped` / `Suspended`), `createdTime`, `lastModifiedTime`, `userType` (Owner / Co-owner), `triggers` (in `properties.definitionSummary.triggers`), `actions` (same path).

To find "my flows that touch SharePoint", list and filter client-side on `properties.connectionReferences[].apiId` containing `sharepointonline`.

## Enabling / disabling

```
flow disable --name <flowGuid> --environmentName <envGuid>
flow enable  --name <flowGuid> --environmentName <envGuid>
```

Confirm before running — a disabled flow misses real events (no replay later).

## Removing

```
flow remove --name <flowGuid> --environmentName <envGuid> --force
```
Soft delete (goes to `flow recyclebinitem`, recoverable for 28 days). Still confirm.

## Run history

```
flow run list   --flowName <flowGuid> --environmentName <envGuid>
flow run get    --name <runId> --flowName <flowGuid> --environmentName <envGuid>
flow run resubmit --name <runId> --flowName <flowGuid> --environmentName <envGuid>
flow run cancel --name <runId> --flowName <flowGuid> --environmentName <envGuid> --force
```

Per run: `name` (run GUID), `status` (`Succeeded` / `Failed` / `Running` / `Cancelled`), `startTime`, `endTime`, error details for failures.

**Debugging a failing flow:** list recent runs, get the first failed one, surface `properties.error.code` + `properties.error.message`. For step-level failures, point the user to the Power Automate UI — the CLI doesn't return per-action telemetry.

## Owners

```
flow owner list   --flowName <flowGuid> --environmentName <envGuid>
flow owner add    --flowName <flowGuid> --environmentName <envGuid> --userId <upn> --roleName CanEdit
flow owner remove --flowName <flowGuid> --environmentName <envGuid> --userId <upn> --force
```

Roles: `CanView`, `CanEdit`. Owners can edit & enable/disable; viewers can only see runs.

## Export / backup

```
flow export --name <flowGuid> --environmentName <envGuid> --packageDisplayName "My Flow" --format zip --path ./flow-backup.zip
flow export --name <flowGuid> --environmentName <envGuid> --format json --path ./flow.json
```

The `zip` format is a solution package (re-importable in Power Automate). `json` is the definition only — useful for diff'ing or storing in git.

## Connectors

```
flow connector list --environmentName <envGuid>
flow connector export --name <connectorName> --environmentName <envGuid> --outputFolder ./
```

Custom connectors only; built-in connectors (SharePoint, Outlook, etc.) aren't listed.

## Reference workflow patterns

**"Why did the flow X fail last night?"**
1. `flow environment list` → environment GUID.
2. `flow list --environmentName <env>` → find flow by displayName, get its GUID.
3. `flow run list --flowName <flow> --environmentName <env>` → find recent `Failed`.
4. `flow run get --name <runId> ...` → surface `properties.error.message`, propose a fix (re-run, edit flow, contact owner).

**"Disable all flows owned by ex-employee"**
1. `flow list --asAdmin --environmentName <env>`.
2. Filter `properties.creator.userPrincipalName === <upn>`.
3. Show the candidate list to the user, ask "disable these N?" before iterating with `flow disable`.

## Caveats

- **`--asAdmin`** requires the user to have Power Platform admin rights. Without it, only flows the user owns/co-owns are listed.
- **Multi-environment tenants** are common in enterprise — always confirm the environment before running mutating commands. "My default flow" might live in a non-default environment.
- **Solution-aware flows** behave slightly differently (they're managed via solutions in Dataverse). Some `flow set` operations are blocked on managed solution flows.
- **Power Automate Desktop** (RPA) flows are NOT covered by these commands — they live in `flow desktop` only via the maker portal.
