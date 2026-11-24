import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth";
import { SOURCE } from "@/lib/config";
import { listMembers } from "@/lib/db";
import { ensureReady } from "@/lib/pipeline";
import { loginAs } from "../actions";

export default async function LoginPage() {
  if (await getCurrentMember()) redirect("/");
  ensureReady();
  const members = listMembers();
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
      <h1 className="text-2xl font-semibold text-neon">Sign in</h1>
      {SOURCE === "mock" ? (
        <>
          <p className="mt-2 text-sm text-muted">
            Local test mode. Pick a simulated Discord member to act as. The real
            site will sign in with Discord instead.
          </p>
          <div className="mt-6 grid gap-2">
            {members.map((m) => (
              <form key={m.discord_id} action={loginAs}>
                <input type="hidden" name="discordId" value={m.discord_id} />
                <button className="card w-full px-4 py-3 text-left hover:border-neon-dim">
                  <span className="font-medium">{m.display_name}</span>
                  <span className="ml-2 font-mono text-xs text-muted">
                    @{m.username}
                  </span>
                </button>
              </form>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Discord sign-in is not set up yet.</p>
      )}
    </main>
  );
}
