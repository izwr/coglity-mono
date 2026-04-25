import { type ReactNode } from "react";

interface StatProps {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaDir?: "up" | "down";
  footer?: ReactNode;
}

export function Stat({ label, value, delta, deltaDir, footer }: StatProps) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && (
        <div className={`delta${deltaDir ? ` ${deltaDir}` : ""}`}>{delta}</div>
      )}
      {footer}
    </div>
  );
}
