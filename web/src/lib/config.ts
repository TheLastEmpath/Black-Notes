// Central settings. Everything that is still undecided (the verify emoji, the
// message source) is a value here, not a constant buried in code.

/**
 * The emoji that verifies a project. Placeholder until the community picks one.
 * Unicode emoji are matched as-is. A custom Discord emoji is matched by its id:
 * set BLACK_NOTES_EMOJI to "name:123456789" (the bot reports it the same way).
 */
export const VERIFY_EMOJI = process.env.BLACK_NOTES_EMOJI ?? "📌";

/** "mock" = simulated Discord (default, nothing leaves this machine). "discord" = real bot, not built yet. */
export const SOURCE = process.env.BLACK_NOTES_SOURCE ?? "mock";

/** Seconds between automatic agent scans while the server runs. 0 turns the loop off. */
export const SCAN_SECONDS = Number(process.env.BLACK_NOTES_SCAN_SECONDS ?? 20);

export function emojiMatches(key: string): boolean {
  return key === VERIFY_EMOJI;
}
