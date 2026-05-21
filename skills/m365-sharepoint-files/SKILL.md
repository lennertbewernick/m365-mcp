---
name: m365-sharepoint-files
description: Discover SharePoint sites and work with files via m365-mcp — list sites, list/upload/download/copy/move files, get sharing links. Use when the user asks about SharePoint sites, "find the document", "upload to SharePoint", "list files in", "share this file", "what sites do I have", or anything involving SPO files / OneDrive documents. Read [[m365-mcp]] first.
---

# SharePoint Files via m365-mcp

The `spo` command group is huge (~378 commands). For files specifically the relevant subgroups are `site`, `file`, `folder`, `web`. Almost every command needs `--webUrl`.

## Discovering sites

```
spo site list                                 # All sites the user can see
spo site list --type CommunicationSite
spo site list --filter "Url -like '*projects*'"
spo site get --url https://tenant.sharepoint.com/sites/marketing
```

Key fields: `Url`, `Title`, `Template` (`GROUP#0` = M365 group site, `SITEPAGEPUBLISHING#0` = communication site, `STS#3` = team site), `Owner`, `StorageUsage`.

**Always resolve a site URL before file operations.** The user may say "the marketing site" — you must find the URL via `spo site list` first.

## Listing files in a folder

```
spo file list --webUrl https://tenant.sharepoint.com/sites/marketing --folder "Shared Documents"
spo file list --webUrl <url> --folder "Shared Documents/Subfolder" --recursive
```

Returns file metadata (no contents). Key fields: `Name`, `ServerRelativeUrl`, `TimeLastModified`, `Length`, `Author`, `ModifiedBy`.

For OneDrive (personal): the user's "site" is `https://tenant-my.sharepoint.com/personal/upn_tenant_com` — find it with `m365 onedrive list` or `spo site list --filter "Url -like '*-my*'"`.

## Getting file info / content

```
spo file get --webUrl <url> --url "/sites/marketing/Shared Documents/file.docx"
spo file get --webUrl <url> --url "/sites/.../file.docx" --asFile --path ./downloaded.docx
spo file get --webUrl <url> --url "/sites/.../file.txt" --asString
```

Options:
- `--asFile --path <local>` — download binary to disk
- `--asString` — return content as string (text files only)
- `--asListItem` — return the SharePoint list-item view (incl. metadata columns)
- Default (no flag) — return the file's metadata JSON

## Uploading

```
spo file add --webUrl <url> --folder "Shared Documents" --path ./local-file.pdf
spo file add --webUrl <url> --folder "Shared Documents" --path ./file.pdf --contentType "Custom Type" --Title "Display Title"
```

`--checkOut` / `--approve` / `--publish` available for governance.

## Copy / move / rename

```
spo file copy   --sourceUrl "/sites/a/Docs/x.docx" --targetUrl "/sites/b/Docs"
spo file move   --sourceUrl "/sites/a/Docs/x.docx" --targetUrl "/sites/b/Docs/Archive"
spo file rename --webUrl <url> --sourceUrl "/sites/a/Docs/x.docx" --targetFileName "renamed.docx"
spo file remove --webUrl <url> --url "/sites/a/Docs/x.docx" --force
```

Mutating — confirm before running.

## Sharing links

```
spo file sharinglink add --webUrl <url> --fileUrl "/sites/.../file.docx" --type view --scope organization
spo file sharinglink list --webUrl <url> --fileUrl "/sites/.../file.docx"
```

`--type`: `view` | `edit` | `review` | `embed` | `blocksDownload`
`--scope`: `anonymous` | `organization` | `users` (named recipients via `--users`)

The anonymous scope requires tenant-level "Anyone" links enabled — may be disabled by policy.

## Search across sites

For "find a document about X across all sites", use:

```
search query --queryText "X filetype:docx" --selectProperties "Title,Path,LastModifiedTime,Author"
```

Microsoft Search returns ranked results across the tenant. Faster than enumerating sites.

## OneDrive shortcuts

```
onedrive list                                 # All OneDrives in tenant (admin)
file list --folderUrl <url>                   # Cross-site file listing
file get --url <url>                          # Download by absolute URL
```

`m365 file` (singular) is a thin convenience layer over `spo file` that works with absolute URLs.

## Common pitfalls

- `--webUrl` must be the **site** URL (`/sites/marketing`), not a subweb path.
- `--folder` is **server-relative** (`Shared Documents/Sub`), not absolute.
- Files in German tenants often live under `"Freigegebene Dokumente"` instead of `"Shared Documents"`. Discover via `spo folder list --webUrl <url>` if unsure.
- `--asString` fails on binary files — only use for `.txt`, `.json`, `.md`, etc. For Word/Excel/PDF, download with `--asFile` and parse locally (the `firecrawl-parse` skill handles PDF/Office files well).
- Large file uploads: `spo file add` chunks automatically above 4 MB but can be slow over the wire.
