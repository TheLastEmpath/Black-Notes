import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dir =
  process.env.BLACK_NOTES_DATA_DIR ?? path.join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });

// Survive Next.js hot reloads without reopening the file.
const g = globalThis as unknown as { __blackNotesDb?: DatabaseSync };
export const db = (g.__blackNotesDb ??= open());

function open(): DatabaseSync {
  const d = new DatabaseSync(path.join(dir, "blacknotes.db"));
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- The simulated Discord server. The mock adapter reads these tables; the
    -- real bot would replace them. Nothing else in the app touches them.
    CREATE TABLE IF NOT EXISTS mock_members (
      discord_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mock_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mock_messages (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      channel_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS mock_reactions (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      UNIQUE (message_id, user_id, emoji)
    );

    -- What the agent has pulled in.
    CREATE TABLE IF NOT EXISTS members (
      discord_id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,                 -- Discord message id
      channel_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      verdict TEXT NOT NULL DEFAULT 'noise', -- noise | theory | candidate | project
      score INTEGER NOT NULL DEFAULT 0,
      reason TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS reactions (
      message_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji)
    );
    CREATE TABLE IF NOT EXISTS scan_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- The catalog. message_id is UNIQUE so re-scans can never duplicate a project.
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_process', -- in_process | deployed
      progress INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      added_by TEXT NOT NULL,
      PRIMARY KEY (project_id, discord_id)
    );
    -- kind: note (build note) | update (progress update) | suggestion | chat
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      body TEXT NOT NULL,
      decision TEXT,                       -- suggestions only: accepted | declined
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  return d;
}

// ---------- types ----------

export type Member = {
  discord_id: string;
  username: string;
  display_name: string;
};
export type Verdict = "noise" | "theory" | "candidate" | "project";
export type Message = {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  verdict: Verdict;
  score: number;
  reason: string;
};
export type Status = "in_process" | "deployed";
export type Project = {
  id: number;
  message_id: string;
  owner_id: string;
  title: string;
  summary: string;
  status: Status;
  progress: number;
  created_at: string;
  updated_at: string;
};
export type NoteKind = "note" | "update" | "suggestion" | "chat";
export type Note = {
  id: number;
  project_id: number;
  author_id: string;
  kind: NoteKind;
  body: string;
  decision: "accepted" | "declined" | null;
  created_at: string;
};

// ---------- members, sessions ----------

export const getMember = (id: string) =>
  db.prepare("SELECT * FROM members WHERE discord_id = ?").get(id) as
    | Member
    | undefined;

export const listMembers = () =>
  db.prepare("SELECT * FROM members ORDER BY display_name").all() as Member[];

export function insertSession(hash: string, id: string, expires: number) {
  db.prepare(
    "INSERT INTO sessions (token_hash, discord_id, expires_at) VALUES (?, ?, ?)",
  ).run(hash, id, expires);
}
export const deleteSession = (hash: string) =>
  void db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hash);
export const purgeExpiredSessions = () =>
  void db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now());
export function getSessionMember(hash: string): Member | undefined {
  return db
    .prepare(
      `SELECT m.* FROM sessions s JOIN members m ON m.discord_id = s.discord_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hash, Date.now()) as Member | undefined;
}

// ---------- projects ----------

export const getProject = (id: number) =>
  db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
    | Project
    | undefined;

export const listProjects = () =>
  db
    .prepare("SELECT * FROM projects ORDER BY updated_at DESC, id DESC")
    .all() as Project[];

export function setProgress(id: number, progress: number, status: Status) {
  db.prepare(
    `UPDATE projects SET progress = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(progress, status, id);
}

export function touchProject(id: number) {
  db.prepare("UPDATE projects SET updated_at = datetime('now') WHERE id = ?").run(
    id,
  );
}

// ---------- team ----------

export const listDelegates = (projectId: number) =>
  db
    .prepare(
      `SELECT m.* FROM project_members pm JOIN members m ON m.discord_id = pm.discord_id
       WHERE pm.project_id = ? ORDER BY m.display_name`,
    )
    .all(projectId) as Member[];

export const isDelegate = (projectId: number, id: string) =>
  !!db
    .prepare(
      "SELECT 1 FROM project_members WHERE project_id = ? AND discord_id = ?",
    )
    .get(projectId, id);

export const addDelegate = (projectId: number, id: string, by: string) =>
  void db
    .prepare(
      `INSERT OR IGNORE INTO project_members (project_id, discord_id, added_by)
       VALUES (?, ?, ?)`,
    )
    .run(projectId, id, by);

export const removeDelegate = (projectId: number, id: string) =>
  void db
    .prepare(
      "DELETE FROM project_members WHERE project_id = ? AND discord_id = ?",
    )
    .run(projectId, id);

// ---------- notes ----------

export const listNotes = (projectId: number, kinds: NoteKind[]) =>
  db
    .prepare(
      `SELECT * FROM notes WHERE project_id = ? AND kind IN (${kinds
        .map(() => "?")
        .join(",")}) ORDER BY id ASC`,
    )
    .all(projectId, ...kinds) as Note[];

export function addNote(
  projectId: number,
  authorId: string,
  kind: NoteKind,
  body: string,
) {
  db.prepare(
    "INSERT INTO notes (project_id, author_id, kind, body) VALUES (?, ?, ?, ?)",
  ).run(projectId, authorId, kind, body);
}

export const getNote = (id: number) =>
  db.prepare("SELECT * FROM notes WHERE id = ?").get(id) as Note | undefined;

export const decideNote = (id: number, decision: "accepted" | "declined") =>
  void db.prepare("UPDATE notes SET decision = ? WHERE id = ?").run(decision, id);

// ---------- messages ----------

export const listMessagesByVerdict = (verdicts: Verdict[]) =>
  db
    .prepare(
      `SELECT * FROM messages WHERE verdict IN (${verdicts
        .map(() => "?")
        .join(",")}) ORDER BY created_at DESC, id DESC`,
    )
    .all(...verdicts) as Message[];

export const listChannels = () =>
  db.prepare("SELECT * FROM channels ORDER BY name").all() as {
    id: string;
    name: string;
  }[];
