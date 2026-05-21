---
name: m365-planner
description: Work with Microsoft Planner via m365-mcp — list plans, buckets, tasks; create/update/complete tasks; assign people. Use when the user asks about Planner, "my Planner tasks", "tasks in the X plan", "create a task", "mark done", "assign to", or anything in Microsoft Planner. For To Do (personal task list), use `m365 todo` instead. Read [[m365-mcp]] first.
---

# Microsoft Planner via m365-mcp

Hierarchy: **Group** → **Plan** → **Bucket** → **Task**. Every Planner plan belongs to a Microsoft 365 Group (the group's members are the plan's members).

Subgroups: `planner plan`, `planner bucket`, `planner task`, `planner roster`, `planner tenant`.

## Listing plans

```
planner plan list --ownerGroupName "Marketing Team"
planner plan list --ownerGroupId <groupId>
planner plan get  --id <planId>
planner plan get  --title "Q2 Roadmap" --ownerGroupName "Marketing Team"
```

You need the owning group's name or ID. Find groups via `entra m365group list` or `entra group list --filter "groupTypes/any(c:c eq 'Unified')"`.

## Buckets in a plan

```
planner bucket list --planId <planId>
planner bucket list --planTitle "Q2 Roadmap" --ownerGroupName "Marketing Team"
planner bucket add  --name "In Review" --planId <planId>
```

Buckets are the columns on the Planner board. They don't have a fixed "Done" — completion lives on tasks themselves.

## Listing tasks

```
planner task list --planId <planId>
planner task list --bucketId <bucketId>
planner task list --planTitle "Q2 Roadmap" --ownerGroupName "Marketing Team"
planner task get  --id <taskId>
```

Task object fields worth knowing: `id`, `title`, `percentComplete` (0/50/100), `priority` (1–10, lower = higher), `dueDateTime`, `bucketId`, `assignments` (object keyed by user ID), `appliedCategories` (labels), `details.description`, `details.checklist`.

A task is "complete" when `percentComplete === 100`.

## Creating a task

```
planner task add \
  --title "Schedule kickoff call" \
  --planId <planId> \
  --bucketName "Backlog" \
  --assignedToUserNames "alice@tenant.com,bob@tenant.com" \
  --dueDateTime "2026-06-15T17:00:00Z" \
  --priority 3 \
  --description "Coordinate with vendor"
```

Useful flags:
- `--assignedToUserNames` / `--assignedToUserIds` — comma-separated
- `--appliedCategories "category1,category3"` — Planner labels (must be enabled on the plan)
- `--orderHint` — controls position in the bucket
- `--startDateTime` — for date-ranged tasks

Confirm details with user before running. Tasks become visible immediately to everyone in the plan.

## Updating a task

```
planner task set --id <taskId> --percentComplete 100        # mark done
planner task set --id <taskId> --title "Renamed" --priority 1
planner task set --id <taskId> --assignedToUserNames "alice@tenant.com"
```

To **unassign everyone**, pass `--assignedToUserNames ""` (empty string).

## Completing / removing

```
planner task set    --id <taskId> --percentComplete 100        # complete (preferred)
planner task remove --id <taskId> --force                     # delete forever
```

Prefer completion over deletion unless the user explicitly wants the task gone.

## Reference workflow patterns

**"What are my open Planner tasks across all plans?"**
There's no native cross-plan query. Enumerate:
1. `entra m365group list --filter "resourceProvisioningOptions/Any(x:x eq 'Team')"` → groups the user is in.
2. For each group, `planner plan list --ownerGroupId <id>`.
3. For each plan, `planner task list --planId <id>` → filter `assignments` includes the user's ID and `percentComplete < 100`.

This is slow for many groups — warn the user before kicking off and offer a single-plan version first.

**"Add a Planner task for the design meeting prep"**
1. Resolve target plan via `planner plan list --ownerGroupName "..."`.
2. Pick bucket (`planner bucket list`).
3. Show proposed `task add` payload to user, await confirmation.
4. Run, echo created task ID and link if available.

## Caveats

- **Microsoft Lists ≠ Planner.** A list with tasks is a SharePoint list — use [[m365-sharepoint-lists]].
- **Personal To Do** is a separate product (`m365 todo`), not Planner.
- **Rosters** (`planner roster`) are an org-less Planner mode used by some Teams apps — different lifecycle, different commands.
- **Pagination:** `task list` can return hundreds of tasks; use `--filter` (OData) where possible. Common filter: `not (status eq 'completed')` — actually Planner doesn't expose `status`, use `percentComplete lt 100`.
- **Time zones:** Due dates accept UTC ISO; the UI renders in the user's local TZ.
