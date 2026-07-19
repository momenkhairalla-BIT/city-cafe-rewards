interface MetricCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function MetricCard({ label, value, hint }: MetricCardProps) {
  return (
    <article className="metric-card">
      <p className="metric-card__label">{label}</p>
      <p className="metric-card__value">{value}</p>
      {hint && <p className="metric-card__hint">{hint}</p>}
    </article>
  );
}
