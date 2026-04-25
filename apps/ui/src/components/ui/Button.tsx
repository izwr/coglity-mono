import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "teal" | "default" | "ghost" | "danger" | "icon" | "icon-danger";
export type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  teal: "btn-teal",
  default: "",
  ghost: "btn-ghost",
  danger: "btn-danger",
  icon: "btn-icon",
  "icon-danger": "btn-icon btn-icon-danger",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className, ...props }, ref) => {
    const cls = [
      "btn",
      VARIANT_CLASS[variant],
      size === "sm" ? "btn-sm" : "",
      className ?? "",
    ].filter(Boolean).join(" ");

    return <button ref={ref} className={cls} {...props} />;
  },
);

Button.displayName = "Button";
