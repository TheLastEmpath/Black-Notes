import { getCurrentMember } from "@/lib/auth";
import { getProject } from "@/lib/db";
import { subscribe, subscribeGlobal } from "@/lib/events";

// Server-sent events. ?project=<id> for one project room, no query for the
// site-wide feed. Signed-in members only. Any member may read any project.
export async function GET(req: Request) {
  const me = await getCurrentMember();
  if (!me) return new Response("Unauthorized", { status: 401 });

  const raw = new URL(req.url).searchParams.get("project");
  const projectId = raw === null ? null : Number(raw);
  if (projectId !== null && (!Number.isInteger(projectId) || !getProject(projectId)))
    return new Response("Not found", { status: 404 });

  const enc = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const listener = (kind: string) => send(`data: ${kind}\n\n`);
      const unsubscribe =
        projectId === null
          ? subscribeGlobal(listener)
          : subscribe(projectId, listener);
      const ping = setInterval(() => send(": ping\n\n"), 25_000);
      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener("abort", cleanup);
      send(": connected\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
