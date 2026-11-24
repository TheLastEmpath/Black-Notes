import { EventEmitter } from "node:events";

// One in-process bus. Fine for a single server; more than one server needs a
// shared broker (Redis, Postgres LISTEN/NOTIFY) behind the same API.
const g = globalThis as unknown as { __blackNotesBus?: EventEmitter };
const bus = (g.__blackNotesBus ??= new EventEmitter().setMaxListeners(0));

const channel = (projectId: number) => `project:${projectId}`;

export function publish(projectId: number, kind: string): void {
  bus.emit(channel(projectId), kind);
}

export function subscribe(
  projectId: number,
  listener: (kind: string) => void,
): () => void {
  bus.on(channel(projectId), listener);
  return () => bus.off(channel(projectId), listener);
}

/** Site-wide pings (new project, catalog changed) for the catalog page. */
export function publishGlobal(kind: string): void {
  bus.emit("global", kind);
}

export function subscribeGlobal(listener: (kind: string) => void): () => void {
  bus.on("global", listener);
  return () => bus.off("global", listener);
}
