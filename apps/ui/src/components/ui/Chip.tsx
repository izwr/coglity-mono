import type { HTMLAttributes, ReactNode } from 'react';

export type ChipVariant =
  | 'neutral'
  | 'pass'
  | 'fail'
  | 'warn'
  | 'info'
  | 'teal'
  | 'run'
  | 'voice'
  | 'chat'
  | 'agent'
  | 'web'
  | 'mobile';

interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: ChipVariant;
  dot?: boolean;
  pulse?: boolean;
  /** 'sm' renders an 18px chip for dense grid rows. */
  size?: 'sm' | 'md';
  children: ReactNode;
}

export function Chip({
  variant = 'neutral',
  dot,
  pulse,
  size = 'md',
  className,
  children,
  ...rest
}: ChipProps) {
  const cls = ['chip', variant, size === 'sm' ? 'chip-sm' : null, className]
    .filter(Boolean)
    .join(' ');
  return (
    <span className={cls} {...rest}>
      {dot && <span className={`dot${pulse ? ' pulse' : ''}`} />}
      {children}
    </span>
  );
}
