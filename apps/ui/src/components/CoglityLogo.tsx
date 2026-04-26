import type { SVGProps } from "react";

export function CoglityLogo({ size = 24, ...props }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} fill="currentColor" {...props}>
      <rect x={1} y={0} width={1} height={1} />
      <rect x={8} y={0} width={1} height={1} />
      <rect x={2} y={1} width={1} height={1} />
      <rect x={7} y={1} width={1} height={1} />
      <rect x={3} y={2} width={4} height={1} />
      <rect x={3} y={3} width={1} height={1} />
      <rect x={6} y={3} width={1} height={1} />
      <rect x={2} y={4} width={2} height={1} />
      <rect x={6} y={4} width={2} height={1} />
      <rect x={0} y={5} width={10} height={1} />
      <rect x={2} y={6} width={6} height={2} />
      <rect x={1} y={8} width={1} height={1} />
      <rect x={3} y={8} width={4} height={1} />
      <rect x={8} y={8} width={1} height={1} />
      <rect x={0} y={9} width={1} height={1} />
      <rect x={9} y={9} width={1} height={1} />
    </svg>
  );
}
