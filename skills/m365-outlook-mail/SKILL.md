---
name: m365-outlook-mail
description: Read, search, triage and send Outlook email via the m365-mcp server. Use when the user asks to "check mail", "list inbox", "find email from / about X", "read the message about Y", "draft a reply", "send a mail to Z", "move to folder", or anything involving their Outlook mailbox. Read [[m365-mcp]] first for auth and safety guidance.
---

# Outlook Mail via m365-mcp

The `outlook` command group covers messages, mailboxes and folders. Always invoke via the `m365_run` tool.

## Listing messages

```
outlook message list --folderName Inbox --top 25
```

Useful flags:
- `--folderName <Inbox|SentItems|Drafts|Archive|DeletedItems|JunkEmail>` — friendly name
- `--folderId <id>` — when the folder is custom
- `--startTime <iso>` / `--endTime <iso>` — date window, ISO 8601 (`2026-05-01T00:00:00Z`)
- `--userName <upn>` — for app-only or delegated other-mailbox scenarios (otherwise the connected user)

The response is an array of message objects. Key fields: `id`, `subject`, `from.emailAddress.address`, `receivedDateTime`, `isRead`, `bodyPreview`, `hasAttachments`, `importance`, `conversationId`.

**Unread filter:** the CLI doesn't expose `--unread` directly — list and filter client-side on `isRead === false`.

## Reading a single message

```
outlook message get --id <messageId>
```

This returns the full message including `body.content` (HTML by default). For thread context, list other messages with the same `conversationId`.

## Searching

The CLI has no native `$search`. Two options:

1. **Filter on list:** combine `--folderName` with date windows.
2. **Microsoft Search:** for cross-mailbox content search, `m365 search` is available but limited.

For "find mail from boss last week", prefer:
```
outlook message list --folderName Inbox --startTime 2026-05-14T00:00:00Z --top 100
```
then filter client-side on `from.emailAddress.address`.

## Moving messages

```
outlook message move --id <messageId> --targetFolderName Archive
```
or `--targetFolderId`. Mutating — confirm with the user first.

## Removing (permanently)

```
outlook message remove --id <messageId> --force
```
Destructive and irreversible. Never call without explicit user confirmation.

## Sending mail

```
outlook mail send \
  --to "person@example.com,other@example.com" \
  --subject "Hi" \
  --bodyContents "Hallo, ..." \
  --bodyContentType HTML
```

Flags:
- `--to` (required), `--cc`, `--bcc` — comma-separated emails
- `--subject` (required)
- `--bodyContents` (required) — supports a string or a file path
- `--bodyContentType <Text|HTML>` — default Text
- `--importance <low|normal|high>`
- `--sender <upn>` — send-as another mailbox (requires delegate rights)
- `--mailbox <upn>` — send on behalf of a shared mailbox

**ALWAYS show the user the final draft (to/cc/subject/body) and ask for explicit confirmation before invoking `outlook mail send`.** This skill never sends a message without an explicit "yes, send it" from the user in the same turn.

## Working with folders

```
outlook mailbox folder list
outlook mailbox settings get
```

## Reports

`outlook report` has 11 commands for tenant-level usage stats — admin-only, rarely relevant for end-user tasks.

## Triage workflow pattern

A typical "triage my inbox" request:

1. `m365_status` — confirm account.
2. `outlook message list --folderName Inbox --top 50`
3. Group by `from.emailAddress.address`, mark `isRead === false`, surface a compact table (date, sender, subject, unread-flag).
4. Offer next actions: read a specific id, mark read, archive, draft a reply.

Never auto-mark mails read or auto-archive without the user saying so explicitly.
