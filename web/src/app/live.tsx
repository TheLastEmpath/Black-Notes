"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Keeps a page live: the server pushes an event the moment anything changes
 * and the page re-renders. Pass a projectId for a project room, or nothing
 * for site-wide changes (the catalog and candidates).
 */
export function Live({ projectId }: { projectId?: number }) {
  const router = useRouter();
  useEffect(() => {
    const url = projectId ? `/events?project=${projectId}` : "/events";
    const source = new EventSource(url);
    source.onmessage = () => router.refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      source.close();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [projectId, router]);
  return null;
}
