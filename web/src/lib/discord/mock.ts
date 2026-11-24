import "server-only";
import { randomBytes } from "node:crypto";
import { db, type Member } from "../db";
import type { DiscordSource, RawMessage, RawReaction } from "./adapter";

// A simulated Discord server stored in the mock_* tables. The /discord page
// writes here the way a real server would receive messages and reactions.

export const mockSource: DiscordSource = {
  listMembers: () =>
    db.prepare("SELECT * FROM mock_members ORDER BY display_name").all() as Member[],
  listChannels: () =>
    db.prepare("SELECT * FROM mock_channels ORDER BY name").all() as {
      id: string;
      name: string;
    }[],
  fetchMessages: (after) =>
    (
      db
        .prepare("SELECT * FROM mock_messages WHERE seq > ? ORDER BY seq")
        .all(after) as {
        seq: number;
        id: string;
        channel_id: string;
        author_id: string;
        content: string;
        created_at: string;
      }[]
    ).map(
      (r): RawMessage => ({
        seq: r.seq,
        id: r.id,
        channelId: r.channel_id,
        authorId: r.author_id,
        content: r.content,
        createdAt: r.created_at,
      }),
    ),
  fetchReactions: (after) =>
    (
      db
        .prepare("SELECT * FROM mock_reactions WHERE seq > ? ORDER BY seq")
        .all(after) as {
        seq: number;
        message_id: string;
        user_id: string;
        emoji: string;
      }[]
    ).map(
      (r): RawReaction => ({
        seq: r.seq,
        messageId: r.message_id,
        userId: r.user_id,
        emoji: r.emoji,
      }),
    ),
};

// ---- simulator writes (mock only) ----

// Looks like a Discord id: a long number, unique per call.
const snowflake = () =>
  `${Date.now()}${String(randomBytes(3).readUIntBE(0, 3)).padStart(8, "0")}`;

export function mockPostMessage(
  channelId: string,
  authorId: string,
  content: string,
): string {
  const id = snowflake();
  db.prepare(
    `INSERT INTO mock_messages (id, channel_id, author_id, content) VALUES (?, ?, ?, ?)`,
  ).run(id, channelId, authorId, content);
  return id;
}

export function mockReact(messageId: string, userId: string, emoji: string) {
  db.prepare(
    `INSERT OR IGNORE INTO mock_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`,
  ).run(messageId, userId, emoji);
}

// ---- fixture ----

const M = {
  ghost: "100000000000000001",
  nyx: "100000000000000002",
  vector: "100000000000000003",
  cipher: "100000000000000004",
  rook: "100000000000000005",
  sable: "100000000000000006",
};

/** Seeds a small fictional server once, so the app has something to show. */
export function seedMockServer(emoji: string): boolean {
  const has = db.prepare("SELECT COUNT(*) AS n FROM mock_members").get() as {
    n: number;
  };
  if (has.n > 0) return false;

  const mem = db.prepare(
    "INSERT INTO mock_members (discord_id, username, display_name) VALUES (?, ?, ?)",
  );
  mem.run(M.ghost, "ghost", "Ghost");
  mem.run(M.nyx, "nyx", "Nyx");
  mem.run(M.vector, "vector", "Vector");
  mem.run(M.cipher, "cipher", "Cipher");
  mem.run(M.rook, "rook", "Rook");
  mem.run(M.sable, "sable", "Sable");

  const ch = db.prepare("INSERT INTO mock_channels (id, name) VALUES (?, ?)");
  ch.run("200000000000000001", "projects");
  ch.run("200000000000000002", "showcase");
  ch.run("200000000000000003", "general");
  const [P, S, G] = [
    "200000000000000001",
    "200000000000000002",
    "200000000000000003",
  ];

  const say = (c: string, a: string, text: string) =>
    mockPostMessage(c, a, text);
  const m1 = say(
    P,
    M.nyx,
    "I'm building an abliteration toolkit that finds the refusal direction in a model's residual stream and projects it out of the weights. Writing it in PyTorch. Repo: https://github.com/example/abliterate. Looking for testers.",
  );
  const m2 = say(
    P,
    M.vector,
    "Just shipped v0.2 of my refusal-direction finder. Open source, demo coming soon. github.com/example/refdir",
  );
  const m3 = say(
    P,
    M.cipher,
    "idea: what if someone should build a benchmark that checks whether an abliterated model keeps its capabilities? would be cool",
  );
  say(
    P,
    M.rook,
    "We're working on a shared set of contrast prompt pairs for finding refusal directions. Prototype is live, need contributors.",
  );
  say(P, M.sable, "Anyone watching the game tonight?");
  const m6 = say(
    S,
    M.ghost,
    "I built a local-first harness that runs MoE models and measures refusal rates before and after abliteration. It's my project, deployed on my homelab and running daily.",
  );
  say(
    S,
    M.sable,
    "Thinking about maybe making a GPU rental dashboard for abliteration jobs, not sure yet. Should I?",
  );
  say(S, M.nyx, "Anyone else hit OOM on the 70B abliteration run today?");
  say(
    G,
    M.vector,
    "My project, a layer-sweep tool for picking the best refusal direction, is now in beta. Roadmap is in the thread.",
  );
  say(G, M.cipher, "lol same");

  // Real verifications (the author reacts) ...
  mockReact(m1, M.nyx, emoji);
  mockReact(m2, M.vector, emoji);
  mockReact(m6, M.ghost, emoji);
  // ... and one that must be ignored (someone else reacts to a theory).
  mockReact(m3, M.rook, emoji);
  return true;
}
