import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  deleteSession,
  getMember,
  getProject,
  getSessionMember,
  insertSession,
  isDelegate,
  purgeExpiredSessions,
  type Member,
  type Project,
} from "./db";

// Identity is a Discord user id. Locally the "login" is picking one of the
// simulated members (mock source only). The real app signs in with Discord
// OAuth and gets the same id, so every check below stays as it is.

const COOKIE = "bk_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function startSession(discordId: string): Promise<void> {
  purgeExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expires = Date.now() + SESSION_MS;
  insertSession(sha(token), discordId, expires);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expires),
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) deleteSession(sha(token));
  store.delete(COOKIE);
}

export async function getCurrentMember(): Promise<Member | undefined> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? getSessionMember(sha(token)) : undefined;
}

export async function requireMember(): Promise<Member> {
  const m = await getCurrentMember();
  if (!m) redirect("/login");
  return m;
}

export { getMember };

// ---- permissions (checked on the server in every action) ----

/** Only the owner (the person whose emoji verified the project). */
export const isOwner = (m: Pick<Member, "discord_id">, p: Project) =>
  m.discord_id === p.owner_id;

/** Owner and delegates write build notes and progress updates. */
export const canBuild = (m: Pick<Member, "discord_id">, p: Project) =>
  isOwner(m, p) || isDelegate(p.id, m.discord_id);

/** Not found rather than forbidden, so ids don't leak. Any signed-in member may view. */
export async function requireProject(
  projectId: number,
): Promise<{ member: Member; project: Project }> {
  const member = await requireMember();
  const project = Number.isInteger(projectId) ? getProject(projectId) : undefined;
  if (!project) notFound();
  return { member, project };
}
