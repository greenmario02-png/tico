// Gráfico simple de evolución de precio (SDD-08 menciona "gráfico simple
// de evolución de precio"): un sparkline SVG hecho a mano, sin sumar una
// librería de charting completa para algo tan pequeño.
export function PriceSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const width = 240;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="text-primary">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
