import { Search, SlidersHorizontal, X } from 'lucide-react'

export type StatusFilter = 'ALL' | 'ONGOING' | 'COMPLETED' | 'CANCELLED'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'ONGOING', label: 'En cours' },
  { value: 'COMPLETED', label: 'Terminées' },
  { value: 'CANCELLED', label: 'Annulées' },
]

type Props = {
  search: string
  onSearchChange: (v: string) => void
  status: StatusFilter
  onStatusChange: (v: StatusFilter) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  minAmount: string
  onMinAmountChange: (v: string) => void
  open: boolean
  onToggleOpen: () => void
  activeCount: number
  onReset: () => void
}

export default function TripHistoryFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  minAmount,
  onMinAmountChange,
  open,
  onToggleOpen,
  activeCount,
  onReset,
}: Props) {
  return (
    <div className="px-5 pt-3 pb-2.5 border-b border-stone-100 dark:border-stone-800 shrink-0 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un trajet..."
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400"
          />
        </div>
        <button
          type="button"
          onClick={onToggleOpen}
          className={`relative flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            open || activeCount > 0
              ? 'border-brand-300 bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'
              : 'border-stone-200 dark:border-stone-700 text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/60'
          }`}
        >
          <SlidersHorizontal size={13} />
          Filtres
          {activeCount > 0 && (
            <span className="grid place-items-center w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] font-bold">{activeCount}</span>
          )}
        </button>
      </div>

      {open && (
        <div className="animate-fade-in-up space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusChange(opt.value)}
                className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                  status === opt.value
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
            <label className="flex items-center gap-1.5">
              du
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 px-2 py-1 outline-none focus:ring-2 focus:ring-brand-400/40"
              />
            </label>
            <label className="flex items-center gap-1.5">
              au
              <input
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
                className="rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 px-2 py-1 outline-none focus:ring-2 focus:ring-brand-400/40"
              />
            </label>
            <label className="flex items-center gap-1.5">
              min.
              <input
                type="number"
                min={0}
                placeholder="XOF"
                value={minAmount}
                onChange={(e) => onMinAmountChange(e.target.value)}
                className="w-20 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 px-2 py-1 outline-none focus:ring-2 focus:ring-brand-400/40"
              />
            </label>
            {activeCount > 0 && (
              <button type="button" onClick={onReset} className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium hover:underline">
                <X size={12} /> Réinitialiser
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
