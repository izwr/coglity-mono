import type { HTMLAttributes, ReactNode } from "react";

export type ChipVariant =
  | "neutral" | "pass" | "fail" | "warn" | "info" | "teal" | "run"
  | "voice" | "chat" | "agent" | "web" | "mobile";

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
}

export function Chip({ variant = "neutral", dot, pulse, className, children, ...rest }: ChipProps) {
  const cls = ["chip", variant, className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {dot && <span className={`dot${pulse ? " pulse" : ""}`} />}
      {children}
    </span>
  );
}
