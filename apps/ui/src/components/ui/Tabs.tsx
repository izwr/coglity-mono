import { type ReactNode } from "react";
import type { ChipVariant } from "./Chip";

export interface TabOption<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: number | string;
  /** Only used by the "chip" variant the chip color for this tab. */
  chipVariant?: ChipVariant;
  /** Only used by the "chip" variant optional leading dot color override. */
  dotColor?: string;
}

interface TabsProps<T extends string = string> {
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "chip" | "segmented" | "underline";
  size?: "sm" | "md";
  className?: string;
}

export function Tabs<T extends string = string>({
  options,
  value,
  onChange,
  variant = "chip",
  size = "md",
  className,
}: TabsProps<T>) {
  const cls = ["tabs", `tabs-${variant}`, size === "sm" ? "tabs-sm" : "", className].filter(Boolean).join(" ");

  if (variant === "chip") {
    return (
      <div className={cls} role="tablist">
        {options.map((opt) => {
          const active = opt.value === value;
          const chipCls = ["chip", opt.chipVariant ?? "neutral", "tab-chip", active ? "active" : "inactive"].join(" ");
          return (
            <button
              key={opt.value}
              role="tab"
              aria-selected={active}
              className={chipCls}
              onClick={() => onChange(opt.value)}
            >
              <span className="dot" style={opt.dotColor ? { color: opt.dotColor } : undefined} />
              <span>{opt.label}</span>
              {opt.count !== undefined && (
                <span className="tab-count">· {opt.count}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cls} role="tablist">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            className={`tab${active ? " active" : ""}`}
            onClick={() => onChange(opt.value)}
          >
            <span className="tab-label">{opt.label}</span>
            {opt.count !== undefined && <span className="tab-count">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
