interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
}

export function Sparkline({ data, color = "var(--teal)", height = 36, fill = true }: SparklineProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return [x, y];
  });
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity="0.1" />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface BarSparklineProps {
  data: number[]; // 0-100 pass %
}

export function BarSparkline({ data }: BarSparklineProps) {
  return (
    <div className="sbar">
      {data.map((v, i) => {
        const cls = v >= 95 ? "" : v >= 85 ? "amber" : "red";
        const h = Math.max(8, Math.round(v));
        return <span key={i} className={cls} style={{ height: `${h}%` }} />;
      })}
    </div>
  );
}
