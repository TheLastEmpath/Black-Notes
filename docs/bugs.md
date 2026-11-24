---
tags:
  - black-notes
  - bugs
created: 2026-11-20T21:17
updated: 2026-11-20T21:17
---
# Known bugs and risks

How we know: **tested** = seen working or failing in the browser, **code** = found by reading the code, **untested** = not tried.

## High (before real use)

| Item | How we know | Fix idea |
| --- | --- | --- |
| Sign-in is "pick a member", with no password. Anyone who can reach the server can act as anyone | code | Replace with Discord OAuth before any hosting. The server binds to 127.0.0.1 until then |
| Next.js 16.4.2 prints a known-vulnerability notice in dev | tested | Upgrade Next.js before hosting (review the changelog first) |
| Real Discord bot not built, so the scan only sees the simulated server | code | Implement the four adapter calls after approval |

## Medium

| Item | How we know | Fix idea |
| --- | --- | --- |
| Removing the emoji in Discord does not remove the project | code | Decide the rule with the owner: archive on removal, or keep |
| Edited or deleted Discord messages are not re-read | code | Handle edit and delete events in the adapter |
| Chat and notes have no edit or delete | code | Add author delete and owner moderation |
| Keyword detector misses phrasing and can mislabel (it only affects the Candidates list, never the catalog) | tested | Tune rules from real data; optional AI mode behind a switch |
| One server only: the live-update bus is in memory | code | Redis or Postgres LISTEN/NOTIFY if it ever runs on more than one server |
| No rate limit on posting | code | Add per-member limits |
| No project archive or owner transfer | code | Add both |

## Low

| Item | How we know | Fix idea |
| --- | --- | --- |
| Progress changes are logged as build notes, which can clutter the list | tested | Separate "updates" tab |
| Mobile layout only checked at desktop width | tested | **Fixed in 0.1.1:** checked at 375px wide, no sideways overflow; tap targets raised to 44px and a Jump to chat link added |
| Chat refresh re-renders the whole page on each message | code | Stream only new messages |
| Messages are shown in Discord-simulated time (UTC) | code | Format in the viewer's timezone |

## Verified working (prototype, tested in the browser)
- A non-author's emoji does not create a project.
- The author's emoji creates the project under the author.
- Re-scans never duplicate a project.
- A non-owner replaying the owner's "add member" request is refused; the same request as the owner works.
- A chat message appears in a second open tab without reloading.
