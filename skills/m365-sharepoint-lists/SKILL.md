---
name: m365-sharepoint-lists
description: Work with SharePoint lists and list items via m365-mcp — discover lists, read/filter items, add/update/delete rows, query with OData or CAML. Use when the user asks about SharePoint lists, "the project tracker", "list items", "add a row to", "update the status in", "all entries where", or anything that's a structured SharePoint list (not files/documents). Read [[m365-mcp]] first.
---

# SharePoint Lists via m365-mcp

`spo list` = the list container. `spo listitem` = the rows inside it. Both require `--webUrl`.

## Discovering lists in a site

```
spo list list --webUrl https://tenant.sharepoint.com/sites/projects
spo list list --webUrl <url> --filter "BaseTemplate eq 100"
spo list get  --webUrl <url> --title "Projects"
spo list get  --webUrl <url> --id <guid>
spo list get  --webUrl <url> --url "/sites/projects/Lists/Projects"
```

Returned fields: `Id` (GUID), `Title`, `BaseTemplate` (100 = generic list, 101 = document library, 106 = calendar, 107 = tasks, 171 = announcements…), `ItemCount`, `Description`, `RootFolder.ServerRelativeUrl`.

To list a site's lists *with* visible-to-users metadata, add `--properties Title,Id,ItemCount,Hidden` and filter `Hidden === false` client-side.

## Reading items

```
spo listitem list --webUrl <url> --listTitle "Projects" --pageSize 50
spo listitem list --webUrl <url> --listId <guid> --filter "Status eq 'Active'"
spo listitem list --webUrl <url> --listUrl "/sites/projects/Lists/Projects" --fields "Title,Status,DueDate,AssignedTo"
spo listitem get  --webUrl <url> --listTitle "Projects" --id 42
```

Identify the list by exactly one of: `--listId`, `--listTitle`, `--listUrl`.

Key flags:
- `--fields "F1,F2,..."` — restrict columns (faster + cleaner output)
- `--filter "OData expression"` — server-side filter, e.g. `Status eq 'Open' and Priority eq 'High'`
- `--camlQuery "<View>...</View>"` — full CAML for complex queries (mutually exclusive with `--filter`)
- `--pageSize N` (default 5000), `--pageNumber 0`

**OData operators worth remembering:**
`eq`, `ne`, `gt`, `lt`, `ge`, `le`, `and`, `or`, `not`, `startswith(Title,'X')`, `substringof('x',Title)`, lookup fields use `FieldName/Title eq 'x'`.

Dates in OData filters: `Created ge datetime'2026-05-01T00:00:00'`.

## Field naming gotcha

SharePoint columns have a **display name** (what the UI shows) and an **internal name** (what OData/CAML uses). They diverge for any column that:
- Originally had spaces or non-ASCII chars (`"Due Date"` → `DueDate` or `_x0020_` encoding)
- Was renamed after creation (internal name is frozen at creation time)

If a filter returns nothing unexpectedly, the field name is the first suspect. Discover internal names via:
```
spo field list --webUrl <url> --listTitle "Projects"
```

## Adding items

```
spo listitem add --webUrl <url> --listTitle "Projects" \
  --Title "New Project" \
  --Status "Planning" \
  --DueDate "2026-06-30"
```

Each `--<FieldInternalName> "value"` sets one column. For lookup/person fields, use the ID:
- Lookup: `--Category 5` (the lookup's target item ID)
- Person: `--AssignedTo "i:0#.f|membership|alice@tenant.com"` (claim format) or numeric user ID

Multi-value: comma-separated. Confirm before adding — items appear in the live SharePoint UI immediately.

## Updating items

```
spo listitem set --webUrl <url> --listTitle "Projects" --id 42 --Status "Done"
```
Same syntax as `add`. Confirm before running.

## Deleting items

```
spo listitem remove --webUrl <url> --listTitle "Projects" --id 42 --force
```
Goes to the site recycle bin (recoverable for 93 days by default), but still destructive — confirm explicitly.

## Attachments on list items

```
spo listitem attachment list --webUrl <url> --listTitle "Projects" --itemId 42
spo listitem attachment add  --webUrl <url> --listTitle "Projects" --itemId 42 --path ./file.pdf
spo listitem attachment remove --webUrl <url> --listTitle "Projects" --itemId 42 --fileName "file.pdf" --force
```

## Working with views

```
spo list view list --webUrl <url> --listTitle "Projects"
spo list view get  --webUrl <url> --listTitle "Projects" --title "Active"
```

A view's `ViewQuery` is the CAML the UI uses — copy it into a `--camlQuery` arg for "show me what the X view shows".

## Workflow patterns

**"How many open tickets in the tracker?"**
1. `spo site list --filter "Url -like '*support*'"` → find site URL.
2. `spo list list --webUrl <url>` → confirm list title.
3. `spo listitem list --webUrl <url> --listTitle "Tickets" --filter "Status eq 'Open'" --fields "Title,Priority,AssignedTo"` → count + summarise.

**"Add a new task to the Projects list"**
1. Resolve site + list as above.
2. Check column structure with `spo field list` if you don't already know it.
3. Show the user the proposed `add` call with all values → wait for "yes".
4. Run `spo listitem add ...`.
5. Echo back the created item's `Id`.

## Caveats

- **Hidden columns:** internal-only fields (`_ModerationComments`, `ID`, etc.) won't accept writes. Stick to user-visible columns.
- **Required fields:** `add` fails if any required column is missing. Run `spo field list --filter "Required eq true"` first if unsure.
- **Calculated / lookup fields are read-only** via `set`.
- **Concurrency:** SharePoint uses ETags; if two clients edit the same item, the second loses. The CLI doesn't expose ETag handling — be aware in batch flows.
