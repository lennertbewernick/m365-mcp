---
name: m365-teams
description: Interact with Microsoft Teams via m365-mcp — list teams, channels, chats, messages, members; send messages to channels. Use when the user asks about Teams chats, channels, "send a Teams message", "who is in the team", "what was said in the channel", "find the chat with X", "list my teams", or anything Teams-related. Read [[m365-mcp]] first.
---

# Microsoft Teams via m365-mcp

Teams is the largest command group after SPO (~72 commands). Most-used subgroups: `team`, `channel`, `chat`, `message`, `user`, `meeting`.

## Teams (top-level containers)

```
teams team list                               # All teams the user is a member of
teams team get --id <teamId>
teams team add --name "Team Name" --description "..."
```

Each team has `id` (Group ID), `displayName`, `description`, `visibility` (private/public).

## Channels (inside a team)

```
teams channel list --teamId <id>
teams channel get --teamId <id> --name "General"
teams channel add --teamId <id> --name "Topic" --description "..."
```

Standard, private and shared channels are all visible.

## Channel messages

```
teams message list --teamId <id> --channelId <channelId>
teams message get  --teamId <id> --channelId <channelId> --id <messageId>
teams message send --teamId <id> --channelId <channelId> --message "Hello team"
teams message reply send --teamId <id> --channelId <channelId> --messageId <parentId> --message "Reply text"
```

`teams message list` returns all top-level posts in the channel; replies live under `replies` per message. For long-running channels, paginate manually — the API caps at ~50 per page.

**Always confirm before sending.** Show the user the team/channel name (resolve via `channel get`) and the exact message body, then ask for explicit go-ahead.

## Chats (1:1 / group, outside teams)

```
teams chat list                               # All your chats
teams chat get --id <chatId>
teams chat get --participants alice@a.com,bob@b.com
teams chat message list --chatId <chatId>
teams chat message send --chatId <chatId> --message "Hi"
```

Chat IDs look like `19:abcd1234@thread.v2` or `19:abcd@unq.gbl.spaces` for 1:1. Always discover via `chat list` — never construct them.

To find a specific chat by person, use `--participants` with a comma-separated UPN list. For 1:1 chats, pass just the other person's UPN.

## Members & users

```
teams user list --teamId <id>                 # Members of a team
teams user add --teamId <id> --userNames "alice@a.com,bob@a.com" --role Member
teams user remove --teamId <id> --userName "alice@a.com" --force
```

Roles: `Owner`, `Member`, `Guest`.

## Meetings

```
teams meeting list --userName <upn>
teams meeting get --joinUrl <url>
teams meeting attendancereport list --meetingId <id> --userName <upn>
teams meeting transcript list --meetingId <id> --userName <upn>
```

Useful for post-meeting follow-up (transcripts, attendance). Transcripts return content as VTT.

## Apps & tabs

`teams app list` / `teams tab list` — installed Teams apps and tabs per channel. Rarely needed for end-user workflows.

## Workflow patterns

**"What was discussed in #general last week?"**
1. `teams team list` → find target team's `id`.
2. `teams channel list --teamId <id>` → find channel `id`.
3. `teams message list --teamId <id> --channelId <id>` → filter by `createdDateTime` window.
4. Summarise per author / thread.

**"Send a message to my chat with Lisa"**
1. `teams chat get --participants lisa@... ` → get `chatId`.
2. Show user the target and exact text → wait for confirmation.
3. `teams chat message send --chatId <id> --message "..."`.

## Caveats

- `teams message send` cannot post into a chat — that's `teams chat message send` (different command).
- Mentions (`@user`) require Graph JSON payloads — the simple `--message` flag does plain text only. For mentions, use `m365 request --url https://graph.microsoft.com/v1.0/teams/{id}/channels/{id}/messages --method POST`.
- Attachments are not supported via `message send`. Upload to SharePoint/OneDrive first and post the link.
- Listing messages on a busy channel is heavy — prefer date filtering where possible.
