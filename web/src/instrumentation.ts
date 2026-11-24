// The autonomous part: while the server runs, the agent scans on a timer.
// (The pages and the simulator also trigger a scan right away.)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { SCAN_SECONDS } = await import("./lib/config");
  if (SCAN_SECONDS <= 0) return;
  const g = globalThis as unknown as { __blackNotesTimer?: unknown };
  if (g.__blackNotesTimer) return;
  const { scan, ensureReady } = await import("./lib/pipeline");
  ensureReady();
  g.__blackNotesTimer = setInterval(() => {
    try {
      scan();
    } catch (e) {
      console.error("[agent] scan failed:", e);
    }
  }, SCAN_SECONDS * 1000);
}
