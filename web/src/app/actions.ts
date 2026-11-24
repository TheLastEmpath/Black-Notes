"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  endSession,
  getCurrentMember,
  isOwner,
  canBuild,
  requireMember,
  requireProject,
  startSession,
} from "@/lib/auth";
import {
  addDelegate,
  addNote,
  decideNote,
  getMember,
  getNote,
  removeDelegate,
  setProgress,
  touchProject,
  type NoteKind,
} from "@/lib/db";
import { SOURCE, VERIFY_EMOJI } from "@/lib/config";
import { publish, publishGlobal } from "@/lib/events";
import { mockPostMessage, mockReact } from "@/lib/discord/mock";
import { ensureReady, scan } from "@/lib/pipeline";

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v.trim() : "";
};

// ---- sign in (simulated members only) ----

export async function loginAs(formData: FormData) {
  if (SOURCE !== "mock") return;
  ensureReady();
  const m = getMember(str(formData, "discordId"));
  if (!m) return;
  await startSession(m.discord_id);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

// ---- owner-only: progress and team ----

export async function updateProgress(projectId: number, formData: FormData) {
  const { member, project } = await requireProject(projectId);
  if (!isOwner(member, project)) return;
  const n = Math.round(Number(str(formData, "progress")));
  const progress = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  const status = str(formData, "status") === "deployed" ? "deployed" : "in_process";
  setProgress(projectId, progress, status);
  addNote(
    projectId,
    member.discord_id,
    "update",
    `Progress ${progress}% · ${status === "deployed" ? "deployed" : "in process"}`,
  );
  publish(projectId, "update");
  publishGlobal("project");
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
}

export async function addProjectDelegate(projectId: number, formData: FormData) {
  const { member, project } = await requireProject(projectId);
  if (!isOwner(member, project)) return; // owner only, for now
  const target = getMember(str(formData, "discordId"));
  if (!target || target.discord_id === project.owner_id) return;
  addDelegate(projectId, target.discord_id, member.discord_id);
  publish(projectId, "team");
  publishGlobal("project");
  revalidatePath(`/projects/${projectId}`);
}

export async function removeProjectDelegate(projectId: number, discordId: string) {
  const { member, project } = await requireProject(projectId);
  if (!isOwner(member, project)) return;
  removeDelegate(projectId, discordId);
  publish(projectId, "team");
  publishGlobal("project");
  revalidatePath(`/projects/${projectId}`);
}

// ---- notes and chat ----

/**
 * note / update: owner and delegates. chat / suggestion: any signed-in member.
 * The author always comes from the session, never from the form.
 */
export async function postNote(projectId: number, kind: NoteKind, formData: FormData) {
  const { member, project } = await requireProject(projectId);
  const body = str(formData, "body").slice(0, 4000);
  if (!body) return;
  if ((kind === "note" || kind === "update") && !canBuild(member, project)) return;
  if (kind !== "note" && kind !== "update" && kind !== "chat" && kind !== "suggestion")
    return;
  addNote(projectId, member.discord_id, kind, body);
  if (kind !== "chat") touchProject(projectId);
  publish(projectId, kind);
  revalidatePath(`/projects/${projectId}`);
}

export async function decideSuggestion(
  projectId: number,
  noteId: number,
  decision: "accepted" | "declined",
) {
  const { member, project } = await requireProject(projectId);
  if (!isOwner(member, project)) return;
  const note = getNote(noteId);
  if (!note || note.project_id !== projectId || note.kind !== "suggestion") return;
  decideNote(noteId, decision);
  publish(projectId, "suggestion");
  revalidatePath(`/projects/${projectId}`);
}

// ---- simulator (mock source only) ----

export async function simPost(formData: FormData) {
  if (SOURCE !== "mock") return;
  const me = await requireMember();
  const content = str(formData, "content").slice(0, 2000);
  const channel = str(formData, "channelId");
  if (!content || !channel) return;
  mockPostMessage(channel, me.discord_id, content); // author is the signed-in member
  scan();
  revalidatePath("/", "layout");
}

export async function simReact(messageId: string) {
  if (SOURCE !== "mock") return;
  const me = await requireMember(); // the reactor is the signed-in member
  mockReact(messageId, me.discord_id, VERIFY_EMOJI);
  scan();
  revalidatePath("/", "layout");
}

export async function runScan() {
  if (!(await getCurrentMember())) return;
  scan();
  revalidatePath("/", "layout");
}
