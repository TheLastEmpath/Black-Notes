import "server-only";
import { SOURCE } from "../config";
import type { Member } from "../db";
import { mockSource } from "./mock";

// The one seam between Discord and the rest of the app. The pipeline only ever
// talks to this interface. The mock below reads a simulated server; the real
// bot (see docs) implements the same four calls. Cursors are opaque numbers the
// source hands back so a scan only pulls what is new.

export type RawMessage = {
  seq: number;
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
};

export type RawReaction = {
  seq: number;
  messageId: string;
  userId: string;
  /** Unicode emoji as-is; custom emoji as "name:id". */
  emoji: string;
};

export interface DiscordSource {
  listMembers(): Member[];
  listChannels(): { id: string; name: string }[];
  fetchMessages(afterSeq: number): RawMessage[];
  fetchReactions(afterSeq: number): RawReaction[];
}

export function getSource(): DiscordSource {
  if (SOURCE === "mock") return mockSource;
  throw new Error(
    `BLACK_NOTES_SOURCE="${SOURCE}" is not built yet. Only "mock" works until the server owner approves a bot.`,
  );
}
