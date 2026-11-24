import { requireMember } from "@/lib/auth";
import { VERIFY_EMOJI } from "@/lib/config";
import { listChannels, listMembers, listMessagesByVerdict } from "@/lib/db";
import { ensureReady, verifyReactors } from "@/lib/pipeline";
import { Live } from "../live";

export default async function Candidates() {
  await requireMember();
  ensureReady();
  const members = new Map(listMembers().map((m) => [m.discord_id, m]));
  const channels = new Map(listChannels().map((c) => [c.id, c.name]));
  const candidates = listMessagesByVerdict(["candidate"]);
  const theories = listMessagesByVerdict(["theory"]);

  const Row = ({ m }: { m: (typeof candidates)[number] }) => {
    const r = verifyReactors(m.id, m.author_id);
    return (
      <li className="card p-4">
        <p className="font-mono text-xs text-muted">
          #{channels.get(m.channel_id) ?? "?"} ·{" "}
          <span className="text-foreground">
            {members.get(m.author_id)?.display_name ?? "unknown"}
          </span>
        </p>
        <p className="mt-2 text-sm">{m.content}</p>
        <p className="mt-2 text-xs text-muted">Agent: {m.reason || "—"}</p>
        <p className="mt-2 text-xs text-warn">
          Waiting for {members.get(m.author_id)?.display_name ?? "the author"} to
          add {VERIFY_EMOJI}
          {r.byOthers > 0 &&
            ` · ${r.byOthers} other${r.byOthers > 1 ? "s" : ""} reacted, which doesn't count`}
        </p>
      </li>
    );
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Live />
      <h1 className="text-2xl font-semibold text-neon">Candidates</h1>
      <p className="mt-1 text-sm text-muted">
        What the agent thinks might be a project. Unverified: nothing here is in
        the catalog until its author adds {VERIFY_EMOJI}.
      </p>

      <h2 className="mt-8 font-mono text-sm text-foreground">
        Likely builds ({candidates.length})
      </h2>
      <ul className="mt-3 grid gap-3">
        {candidates.map((m) => <Row key={m.id} m={m} />)}
        {candidates.length === 0 && (
          <li className="text-sm text-muted">None waiting.</li>
        )}
      </ul>

      <h2 className="mt-8 font-mono text-sm text-foreground">
        Sounds theoretical ({theories.length})
      </h2>
      <ul className="mt-3 grid gap-3">
        {theories.map((m) => <Row key={m.id} m={m} />)}
        {theories.length === 0 && (
          <li className="text-sm text-muted">None.</li>
        )}
      </ul>
    </main>
  );
}
