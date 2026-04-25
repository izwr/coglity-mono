import { type HTMLAttributes, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  pad?: boolean;
  hover?: boolean;
}

export function Card({ children, pad = true, hover, className, ...rest }: CardProps) {
  const cls = [
    "card",
    pad ? "card-pad" : "",
    hover ? "hover" : "",
    className ?? "",
  ].filter(Boolean).join(" ");
  return <div className={cls} {...rest}>{children}</div>;
}

export function CardHead({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card-head">
      <h3>{title}</h3>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
