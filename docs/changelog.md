---
tags:
  - black-notes
  - changelog
created: 2026-11-20T21:17
updated: 2026-11-20T21:17
---
# Developer changelog

## 0.1.0 (prototype)

- New project, structured like Blue Notes: Next.js 16.4.2, built-in SQLite, server-sent events, server-side permission checks. The business parts (roles, documents, procedures) were left out.
- Discord adapter interface with a simulated server and seeded fixture (6 members, 3 channels, 10 messages).
- Agent scan: cursor-based pull, rule-based labels, author-only emoji verification, idempotent project creation.
- Pages: Projects (grouped by owner, progress bars, status filter), Candidates, Discord sim, project room.
- Project room: owner-only progress and team, build notes (owner and team), suggestions with owner accept/decline, live chat.
- Timer loop scans every 20 seconds while the server runs.

### Tests (browser, this machine)
- Non-author emoji ignored: passed.
- Author emoji creates project: passed.
- Two re-scans, no duplicate: passed.
- Non-owner replay of owner's add-member request refused; owner replay works (control): passed.
- Live chat in a second tab: passed.
- Not tested: phone width, many users, long messages.
