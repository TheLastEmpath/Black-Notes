"use client";

import { useEffect, useRef } from "react";

/** Scrolls to the newest message whenever the count changes. */
export function ChatLog({
  count,
  children,
}: {
  count: number;
  children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    <div ref={box} className="h-[26rem] overflow-y-auto pr-1">
      {children}
    </div>
  );
}
