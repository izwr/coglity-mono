import { type ReactNode } from "react";

interface PageHeadProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHead({ title, subtitle, actions }: PageHeadProps) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        <h1>{title}</h1>
        {subtitle && <div className="sub">{subtitle}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
