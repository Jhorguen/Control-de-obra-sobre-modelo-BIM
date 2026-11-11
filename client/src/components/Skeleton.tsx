/** Placeholder rows while a table or panel loads: the shape of the content, not a spinner. */
export function Skeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      <div className="skeleton-line tall" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${92 - ((i * 17) % 30)}%` }} />
      ))}
    </div>
  );
}
