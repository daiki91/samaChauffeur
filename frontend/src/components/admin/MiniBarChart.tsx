type Bar = { label: string; value: number; colorClass?: string }

/** Small dependency-free horizontal bar chart — no charting library needed for the admin overview. */
export default function MiniBarChart({ data, emptyLabel = 'Aucune donnée' }: { data: Bar[]; emptyLabel?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (total === 0) {
    return <p className="text-sm text-stone-400 py-6 text-center">{emptyLabel}</p>
  }

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-xs text-stone-500 truncate">{d.label}</div>
          <div className="flex-1 h-3 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${d.colorClass || 'bg-brand-500'}`}
              style={{ width: `${Math.round((d.value / max) * 100)}%` }}
            />
          </div>
          <div className="w-8 shrink-0 text-xs font-semibold text-stone-700 text-right">{d.value}</div>
        </div>
      ))}
    </div>
  )
}
