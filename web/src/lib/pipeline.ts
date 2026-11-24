import "server-only";
import { emojiMatches, VERIFY_EMOJI } from "./config";
import { db, type Message } from "./db";
import { detect, titleFrom } from "./detect";
import { getSource } from "./discord/adapter";
import { seedMockServer } from "./discord/mock";
import { publishGlobal } from "./events";
import { SOURCE } from "./config";

// The agent. One scan = pull new members, messages and reactions from the
// source, label each new message, then verify.
//
// Verification rule (the "logical step"): a message becomes a project only when
// its AUTHOR adds the verify emoji to it. A reaction from anyone else is
// recorded but does nothing. The author becomes the project's owner.
//
// Safe to run any number of times: messages and reactions are inserted with
// INSERT OR IGNORE, and projects.message_id is UNIQUE, so a re-scan can never
// duplicate anything. Removing the emoji later does not delete the project;
// the owner archives it from the project page (not built yet).

const getCursor = (key: string): number =>
  Number(
    (
      db.prepare("SELECT value FROM scan_state WHERE key = ?").get(key) as
        | { value: string }
        | undefined
    )?.value ?? 0,
  );
const setCursor = (key: string, v: number) =>
  db
    .prepare(
      `INSERT INTO scan_state (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, String(v));

export type ScanResult = {
  newMessages: number;
  newReactions: number;
  newProjects: number;
};

export function scan(): ScanResult {
  const src = getSource();
  const result: ScanResult = { newMessages: 0, newReactions: 0, newProjects: 0 };

  db.exec("BEGIN");
  try {
    const upMember = db.prepare(
      `INSERT INTO members (discord_id, username, display_name) VALUES (?, ?, ?)
       ON CONFLICT(discord_id) DO UPDATE SET username = excluded.username, display_name = excluded.display_name`,
    );
    for (const m of src.listMembers())
      upMember.run(m.discord_id, m.username, m.display_name);
    const upChannel = db.prepare(
      `INSERT INTO channels (id, name) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`,
    );
    for (const c of src.listChannels()) upChannel.run(c.id, c.name);

    const insMsg = db.prepare(
      `INSERT OR IGNORE INTO messages
         (id, channel_id, author_id, content, created_at, verdict, score, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    let mc = getCursor("messages");
    for (const m of src.fetchMessages(mc)) {
      const d = detect(m.content);
      const r = insMsg.run(
        m.id, m.channelId, m.authorId, m.content, m.createdAt,
        d.verdict, d.score, d.reason,
      );
      result.newMessages += Number(r.changes);
      mc = Math.max(mc, m.seq);
    }
    setCursor("messages", mc);

    const insRe = db.prepare(
      "INSERT OR IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)",
    );
    let rc = getCursor("reactions");
    for (const r of src.fetchReactions(rc)) {
      result.newReactions += Number(
        insRe.run(r.messageId, r.userId, r.emoji).changes,
      );
      rc = Math.max(rc, r.seq);
    }
    setCursor("reactions", rc);

    result.newProjects = verify();
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (result.newProjects || result.newMessages || result.newReactions)
    publishGlobal("scan");
  return result;
}

/** Promote every message its own author has marked. Returns how many are new. */
function verify(): number {
  const marked = (
    db
      .prepare(
        `SELECT DISTINCT m.*, r.emoji AS emoji
         FROM messages m JOIN reactions r
           ON r.message_id = m.id AND r.user_id = m.author_id
         WHERE m.id NOT IN (SELECT message_id FROM projects)`,
      )
      .all() as (Message & { emoji: string })[]
  ).filter((m) => emojiMatches(m.emoji));

  const ins = db.prepare(
    `INSERT OR IGNORE INTO projects (message_id, owner_id, title, summary)
     VALUES (?, ?, ?, ?)`,
  );
  const mark = db.prepare("UPDATE messages SET verdict = 'project' WHERE id = ?");
  let n = 0;
  for (const m of marked) {
    n += Number(
      ins.run(m.id, m.author_id, titleFrom(m.content), m.content.slice(0, 600))
        .changes,
    );
    mark.run(m.id);
  }
  return n;
}

/** Who has reacted with the verify emoji on a message, and whether it counts. */
export function verifyReactors(messageId: string, authorId: string) {
  const rows = db
    .prepare("SELECT user_id, emoji FROM reactions WHERE message_id = ?")
    .all(messageId) as { user_id: string; emoji: string }[];
  const marks = rows.filter((r) => emojiMatches(r.emoji));
  return {
    byAuthor: marks.some((r) => r.user_id === authorId),
    byOthers: marks.filter((r) => r.user_id !== authorId).length,
  };
}

/** First run only: fill the simulated server, scan it, add demo progress. */
export function ensureReady(): void {
  const g = globalThis as unknown as { __blackNotesReady?: boolean };
  if (g.__blackNotesReady) return;
  g.__blackNotesReady = true;
  if (SOURCE !== "mock") return;
  const fresh = seedMockServer(VERIFY_EMOJI);
  scan();
  if (!fresh) return;
  const bump = (needle: string, progress: number, status = "in_process") =>
    db
      .prepare(
        "UPDATE projects SET progress = ?, status = ? WHERE title LIKE ?",
      )
      .run(progress, status, `%${needle}%`);
  bump("abliteration toolkit", 45);
  bump("refusal-direction finder", 70);
  bump("local-first harness", 100, "deployed");
}
