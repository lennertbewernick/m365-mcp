---
name: m365-outlook-calendar
description: Read, search and manage Outlook calendar events via m365-mcp. Use when the user asks "what's on my calendar", "find a free slot", "list meetings", "show today's agenda", "cancel the 3pm meeting", "events next week", or anything about their Outlook calendar / appointments. Read [[m365-mcp]] first.
---

# Outlook Calendar via m365-mcp

Calendar functionality lives under two command groups:

- `outlook calendar` — calendar containers (one user can have multiple)
- `outlook event` — events inside a calendar

## Listing events

```
outlook event list --startDateTime 2026-05-21T00:00:00 --endDateTime 2026-05-28T00:00:00 --timeZone "Europe/Berlin"
```

Flags:
- `--startDateTime`, `--endDateTime` — ISO 8601, **inclusive start, exclusive end**
- `--timeZone` — IANA tz, e.g. `Europe/Berlin`. Without this, returned times are UTC.
- `--calendarName` or `--calendarId` — defaults to primary calendar
- `--userName <upn>` / `--userId <id>` — for other-user scenarios (needs permission)
- `--filter <odata>` — OData filter, e.g. `categories/any(c:c eq 'red')`
- `--properties subject,start,end,attendees,location` — restrict fields

Each event has: `id`, `subject`, `start.dateTime`, `end.dateTime`, `location.displayName`, `attendees[].emailAddress.address`, `organizer`, `isOnlineMeeting`, `onlineMeeting.joinUrl`, `bodyPreview`, `showAs`, `categories`.

## "What's on my calendar today/this week" pattern

Always anchor on the user's local date and `Europe/Berlin` unless they say otherwise:

1. Compute today's 00:00 and tomorrow's 00:00 in `Europe/Berlin`.
2. Call `outlook event list --startDateTime <today> --endDateTime <next-day> --timeZone "Europe/Berlin"`.
3. Sort by `start.dateTime`, render as: `HH:mm – HH:mm  Subject  (Location / Online)`.
4. Highlight conflicts (overlapping events).

For "next week" use Monday-to-Monday.

## Finding free slots

The CLI exposes no native free/busy endpoint, so fall back to listing events for the candidate window and computing gaps client-side. For multi-attendee scheduling, use the built-in Microsoft 365 MCP's `find_meeting_availability` tool if available — it's purpose-built for this.

## Cancelling an event

```
outlook event cancel --id <eventId> --comment "Cannot make it, sorry"
```
This sends a cancellation notice to attendees. Confirm with the user first — attendees will get a notification.

## Removing an event

```
outlook event remove --id <eventId> --force
```
Removes from your calendar without notifying attendees. Useful for events you organized that haven't been sent yet, or events you were invited to.

`cancel` vs `remove`: the user almost always means `cancel` if they're the organizer.

## Calendars (containers)

```
outlook calendar get
outlook calendar add --name "Side projects"
outlook calendar set --id <calId> --name "New name"
outlook calendar remove --id <calId> --force
```

Most users only have the default calendar — only touch these if asked explicitly.

## Rooms & room lists

```
outlook room list
outlook roomlist list
```
Returns bookable meeting rooms in the tenant. Useful when scheduling meetings that need a room.

## Caveats

- The CLI cannot **create** events (`outlook event add` doesn't exist). For event creation, use Graph directly via `m365 request --url https://graph.microsoft.com/v1.0/me/events --method POST --body '...'`.
- Recurring events: `event list` returns the series master, not individual instances. To enumerate instances, use Graph's `/calendar/calendarView` via `m365 request`.
- All-day events have `start.dateTime` at 00:00 in the event's own timezone — careful when comparing to wall-clock.
