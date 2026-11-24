import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { listDelegates, listMembers, listProjects } from "@/lib/db";
import { ensureReady } from "@/lib/pipeline";
import { Live } from "./live";
import { ProgressBar, StatusBadge } from "./progress";

const FILTERS = [
  ["all", "All"],
  ["in_process", "In process"],
  ["deployed", "Deployed"],
] as const;

export default async function Catalog({ searchParams }: PageProps<"/">) {
  await requireMember();
  ensureReady();
  const sp = await searchParams;
  const f = typeof sp.status === "string" ? sp.status : "all";
  const filter = f === "in_process" || f === "deployed" ? f : "all";

  const projects = listProjects().filter(
    (p) => filter === "all" || p.status === filter,
  );
  const owners = listMembers().filter((m) =>
    projects.some((p) => p.owner_id === m.discord_id),
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Live />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neon">Projects</h1>
          <p className="mt-1 text-sm text-muted">
            Builds verified with the emoji in Discord, listed under whoever
            marked them.
          </p>
        </div>
        <div className="flex gap-2">
          {FILTERS.map(([v, label]) => (
            <Link
              key={v}
              href={v === "all" ? "/" : `/?status=${v}`}
              className={`btn ${filter === v ? "" : "btn-quiet"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {owners.length === 0 && (
        <p className="mt-10 text-muted">
          Nothing here yet. A project appears once its author adds the emoji to
          their message in Discord.
        </p>
      )}

      {owners.map((o) => (
        <section key={o.discord_id} className="mt-8">
          <h2 className="font-mono text-sm text-muted">
            <span className="text-foreground">{o.display_name}</span> @{o.username}
          </h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {projects
              .filter((p) => p.owner_id === o.discord_id)
              .map((p) => {
                const team = listDelegates(p.id);
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="card block p-4 hover:border-neon-dim"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{p.title}</h3>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={p.progress} status={p.status} />
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      {team.length === 0
                        ? "Solo"
                        : `Team: ${team.map((t) => t.display_name).join(", ")}`}
                    </p>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </main>
  );
}
