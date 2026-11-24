import Link from "next/link";
import { canBuild, isOwner, requireProject } from "@/lib/auth";
import { listDelegates, listMembers, listNotes } from "@/lib/db";
import {
  addProjectDelegate,
  decideSuggestion,
  postNote,
  removeProjectDelegate,
  updateProgress,
} from "../../actions";
import { Live } from "../../live";
import { ProgressBar, StatusBadge } from "../../progress";
import { ChatLog } from "./chat-log";
import { Composer } from "./composer";

const when = (s: string) => s.slice(0, 16).replace("T", " ");

export default async function ProjectRoom({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const projectId = Number(id);
  const { member, project } = await requireProject(projectId);
  const members = new Map(listMembers().map((m) => [m.discord_id, m]));
  const name = (x: string) => members.get(x)?.display_name ?? "unknown";

  const owner = isOwner(member, project);
  const builder = canBuild(member, project);
  const delegates = listDelegates(projectId);
  const addable = [...members.values()].filter(
    (m) =>
      m.discord_id !== project.owner_id &&
      !delegates.some((d) => d.discord_id === m.discord_id),
  );
  const buildNotes = listNotes(projectId, ["note", "update"]);
  const suggestions = listNotes(projectId, ["suggestion"]);
  const chat = listNotes(projectId, ["chat"]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Live projectId={projectId} />
      <Link href="/" className="text-sm text-muted hover:text-neon">← Projects</Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{project.title}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="mt-1 font-mono text-xs text-muted">
          owner <span className="text-foreground">{name(project.owner_id)}</span> ·
          verified from Discord
        </p>
        <div className="mt-4 max-w-xl">
          <ProgressBar value={project.progress} status={project.status} />
        </div>
        <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm text-muted">
          {project.summary}
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="grid content-start gap-6">
          {owner && (
            <section className="card p-4">
              <h2 className="font-mono text-sm text-neon">Progress (owner only)</h2>
              <form
                action={updateProgress.bind(null, projectId)}
                className="mt-3 flex flex-wrap items-center gap-3"
              >
                <input
                  type="range"
                  name="progress"
                  min={0}
                  max={100}
                  defaultValue={project.progress}
                  className="w-48 accent-[var(--neon)]"
                />
                <select name="status" defaultValue={project.status} className="field w-40">
                  <option value="in_process">In process</option>
                  <option value="deployed">Deployed</option>
                </select>
                <button className="btn">Save</button>
              </form>
            </section>
          )}

          <section className="card p-4">
            <h2 className="font-mono text-sm text-neon">Team</h2>
            <ul className="mt-3 flex flex-wrap gap-2 text-sm">
              <li className="rounded border border-neon-dim px-2 py-1">
                {name(project.owner_id)} <span className="text-muted">owner</span>
              </li>
              {delegates.map((d) => (
                <li key={d.discord_id} className="flex items-center gap-2 rounded border border-line px-2 py-1">
                  {d.display_name}
                  {owner && (
                    <form action={removeProjectDelegate.bind(null, projectId, d.discord_id)}>
                      <button aria-label={`Remove ${d.display_name}`} className="text-muted hover:text-danger">✕</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {owner ? (
              <form action={addProjectDelegate.bind(null, projectId)} className="mt-3 flex gap-2">
                <select name="discordId" className="field max-w-xs">
                  {addable.map((m) => (
                    <option key={m.discord_id} value={m.discord_id}>{m.display_name}</option>
                  ))}
                </select>
                <button className="btn" disabled={addable.length === 0}>Add to project</button>
              </form>
            ) : (
              <p className="mt-3 text-xs text-muted">Only the owner can add or remove people.</p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="font-mono text-sm text-neon">Build notes</h2>
            <ul className="mt-3 grid gap-3">
              {buildNotes.map((n) => (
                <li key={n.id} className="border-l-2 border-neon-dim pl-3 text-sm">
                  <p className="font-mono text-xs text-muted">
                    {name(n.author_id)} · {n.kind === "update" ? "update · " : ""}
                    {when(n.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                </li>
              ))}
              {buildNotes.length === 0 && (
                <li className="text-sm text-muted">No notes yet.</li>
              )}
            </ul>
            {builder ? (
              <div className="mt-4">
                <Composer
                  action={postNote.bind(null, projectId, "note")}
                  placeholder="Log a change, a decision, what you pushed…"
                  button="Add build note"
                />
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted">
                Only the owner and added members write build notes. Use
                Suggestions or Chat.
              </p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="font-mono text-sm text-neon">Suggestions</h2>
            <ul className="mt-3 grid gap-3">
              {suggestions.map((n) => (
                <li key={n.id} className="border-l-2 border-cyan pl-3 text-sm">
                  <p className="font-mono text-xs text-muted">
                    {name(n.author_id)} · {when(n.created_at)}
                    {n.decision && (
                      <span className={n.decision === "accepted" ? "ml-2 text-neon" : "ml-2 text-danger"}>
                        {n.decision}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                  {owner && !n.decision && (
                    <div className="mt-2 flex gap-2">
                      <form action={decideSuggestion.bind(null, projectId, n.id, "accepted")}>
                        <button className="btn">Accept</button>
                      </form>
                      <form action={decideSuggestion.bind(null, projectId, n.id, "declined")}>
                        <button className="btn btn-quiet">Decline</button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
              {suggestions.length === 0 && (
                <li className="text-sm text-muted">No suggestions yet.</li>
              )}
            </ul>
            <div className="mt-4">
              <Composer
                action={postNote.bind(null, projectId, "suggestion")}
                placeholder="Suggest a change or an improvement…"
                button="Suggest"
              />
            </div>
          </section>
        </div>

        <section className="card h-fit p-4 lg:sticky lg:top-4">
          <h2 className="font-mono text-sm text-neon">Live chat</h2>
          <div className="mt-3">
            <ChatLog count={chat.length}>
              <ul className="grid gap-3">
                {chat.map((n) => (
                  <li key={n.id} className="text-sm">
                    <p className="font-mono text-xs text-muted">
                      <span className={n.author_id === member.discord_id ? "text-neon" : "text-foreground"}>
                        {name(n.author_id)}
                      </span>{" "}
                      · {when(n.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap">{n.body}</p>
                  </li>
                ))}
                {chat.length === 0 && <li className="text-sm text-muted">Quiet so far.</li>}
              </ul>
            </ChatLog>
          </div>
          <div className="mt-3">
            <Composer
              action={postNote.bind(null, projectId, "chat")}
              placeholder="Message the room (Enter to send)"
              button="Send"
            />
          </div>
        </section>
      </div>
    </main>
  );
}
