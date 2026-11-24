import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { SOURCE, VERIFY_EMOJI } from "@/lib/config";
import { db, listChannels, listMembers, type Message } from "@/lib/db";
import { ensureReady, verifyReactors } from "@/lib/pipeline";
import { runScan, simPost, simReact } from "../actions";
import { Live } from "../live";

// Stand-in for the Discord server while the real bot is not approved. You act
// as the signed-in member: post as them, react as them.
export default async function DiscordSim() {
  if (SOURCE !== "mock") notFound();
  const me = await requireMember();
  ensureReady();
  const channels = listChannels();
  const members = new Map(listMembers().map((m) => [m.discord_id, m]));
  const chan = new Map(channels.map((c) => [c.id, c.name]));
  const messages = db
    .prepare("SELECT * FROM messages ORDER BY created_at DESC, id DESC")
    .all() as Message[];

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Live />
      <h1 className="text-2xl font-semibold text-neon">Discord simulator</h1>
      <p className="mt-1 text-sm text-muted">
        You are acting as <b className="text-foreground">{me.display_name}</b>.
        Post a message, or add {VERIFY_EMOJI} to one. Only the author&apos;s{" "}
        {VERIFY_EMOJI} makes a project.
      </p>

      <form action={simPost} className="card mt-6 grid gap-2 p-4">
        <select name="channelId" className="field">
          {channels.map((c) => (
            <option key={c.id} value={c.id}>#{c.name}</option>
          ))}
        </select>
        <textarea
          name="content"
          required
          rows={3}
          placeholder="Say something, like you would in Discord…"
          className="field"
        />
        <div className="flex gap-2">
          <button className="btn">Post as {me.display_name}</button>
        </div>
      </form>

      <form action={runScan} className="mt-3">
        <button className="btn btn-quiet">Run agent scan now</button>
      </form>

      <ul className="mt-6 grid gap-3">
        {messages.map((m) => {
          const r = verifyReactors(m.id, m.author_id);
          const author = members.get(m.author_id);
          return (
            <li key={m.id} className="card p-4">
              <p className="font-mono text-xs text-muted">
                #{chan.get(m.channel_id)} ·{" "}
                <span className="text-foreground">{author?.display_name}</span>
                <span className="ml-2 rounded border border-line px-1.5">
                  {m.verdict}
                </span>
              </p>
              <p className="mt-2 text-sm">{m.content}</p>
              <form action={simReact.bind(null, m.id)} className="mt-3">
                <button className="btn btn-quiet">
                  {VERIFY_EMOJI}
                  {r.byAuthor ? " ✓ author" : ""}
                  {r.byOthers > 0 ? ` +${r.byOthers}` : ""}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
