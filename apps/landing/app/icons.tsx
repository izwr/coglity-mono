export function ArrowRight({ size = 13 }: { size?: number }) {
  return (
    <svg
      className="arr"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}
