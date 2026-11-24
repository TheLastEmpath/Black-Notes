import type { Status } from "@/lib/db";

export function ProgressBar({
  value,
  status,
}: {
  value: number;
  status: Status;
}) {
  const done = status === "deployed";
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 flex-1 overflow-hidden rounded bg-surface-2"
      >
        <div
          className={`h-full ${done ? "bg-cyan" : "bg-neon"}`}
          style={{ width: `${value}%`, boxShadow: "0 0 8px currentColor" }}
        />
      </div>
      <span className="w-10 text-right font-mono text-xs text-muted">{value}%</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return status === "deployed" ? (
    <span className="rounded border border-cyan/50 px-2 py-0.5 font-mono text-xs text-cyan">
      deployed
    </span>
  ) : (
    <span className="rounded border border-neon-dim px-2 py-0.5 font-mono text-xs text-neon">
      in process
    </span>
  );
}
