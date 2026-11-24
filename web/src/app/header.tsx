import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";
import { SOURCE, VERIFY_EMOJI } from "@/lib/config";
import { logout } from "./actions";

const link = "text-muted hover:text-neon";

export async function Header() {
  const me = await getCurrentMember();
  return (
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <Link href="/" className="font-mono font-bold text-neon">
          {VERIFY_EMOJI} black_notes
        </Link>
        {me && (
          <>
            <Link href="/" className={link}>Projects</Link>
            <Link href="/candidates" className={link}>Candidates</Link>
            {SOURCE === "mock" && (
              <Link href="/discord" className={link}>Discord sim</Link>
            )}
          </>
        )}
        <span className="ml-auto flex items-center gap-3">
          {SOURCE === "mock" && (
            <span className="rounded border border-warn/40 px-2 py-0.5 font-mono text-xs text-warn">
              simulated Discord
            </span>
          )}
          {me ? (
            <>
              <span className="text-foreground">{me.display_name}</span>
              <form action={logout}>
                <button className="btn btn-quiet">Switch</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn">Sign in</Link>
          )}
        </span>
      </nav>
    </header>
  );
}
