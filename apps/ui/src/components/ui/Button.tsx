import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "ghost" | "danger" | "icon" | "icon-danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    const cls = [
      "btn",
      `btn-${variant}`,
      size === "sm" ? "btn-sm" : "",
      className ?? "",
    ].filter(Boolean).join(" ");

    return <button ref={ref} className={cls} {...props} />;
  },
);

Button.displayName = "Button";