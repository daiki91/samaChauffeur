import { useEffect, useMemo, useState } from 'react'
import { getDriverStats, downloadDriverReport } from '../../lib/driverApi'
import { useToasts } from '../../components/Toasts'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Spinner from '../../components/ui/Spinner'
import MiniBarChart from '../../components/admin/MiniBarChart'
import { BarChart3, Route as RouteIcon, Wallet, CheckCircle2, TrendingUp, Download, ChevronLeft, ChevronRight } from 'lucide-react'

type Preset = 'day' | 'week' | 'month' | 'year' | 'custom'

const PERIOD_OPTIONS: { value: Preset; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
  { value: 'custom', label: 'Personnalisé' },
]

type Stats = {
  total_trips: number
  total_distance_km: number
  total_earnings: number
  average_price: number
  breakdown: { label: string; trips: number; distance_km: number; earnings: number }[]
}

function toDateInputValue(d: Date) {
  return d.toISOString().slice(0, 10)
}

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// Describes the resolved range at the granularity the preset itself implies — no point
// spelling out an hour next to "Jour" (it's obviously today), or a full date range next
// to "Année" (it's obviously that whole year). Past periods (reached via prev/next) drop
// the "Aujourd'hui"/"Cette semaine" framing since it would be inaccurate.
function formatPeriodLabel(preset: Preset, from: Date, to: Date): string {
  const now = new Date()
  if (preset === 'day') {
    const label = `${from.getDate()} ${MONTHS_FR[from.getMonth()]} ${from.getFullYear()}`
    return isSameDay(from, now) ? `Aujourd'hui, ${label}` : label
  }
  if (preset === 'week') {
    const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
    const range = sameMonth
      ? `${from.getDate()} - ${to.getDate()} ${MONTHS_FR[from.getMonth()]} ${to.getFullYear()}`
      : `${from.getDate()} ${MONTHS_FR[from.getMonth()]} - ${to.getDate()} ${MONTHS_FR[to.getMonth()]} ${to.getFullYear()}`
    // Compare by calendar date, not by comparing against `to` directly: `to` gets capped
    // to "now" at fetch time, and a few ms will always have ticked by by the time this
    // renders — a millisecond-precise comparison would near-always read as "in the past".
    const mondayOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
    const includesToday = isSameDay(from, mondayOfNow)
    return includesToday ? `Cette semaine, ${range}` : `Semaine du ${range}`
  }
  if (preset === 'month') {
    return `${MONTHS_FR[from.getMonth()][0].toUpperCase()}${MONTHS_FR[from.getMonth()].slice(1)} ${from.getFullYear()}`
  }
  if (preset === 'year') {
    return `Année ${from.getFullYear()}`
  }
  return `Du ${from.toLocaleDateString('fr-FR')} au ${to.toLocaleDateString('fr-FR')}`
}

// Calendar-aligned ranges around a navigable anchor date (defaults to today), capped at
// "now" so a period spanning into the future never claims data that can't exist yet.
function presetRange(preset: Preset, anchor: Date, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date()
  const cap = (d: Date) => (d.getTime() > now.getTime() ? now : d)

  if (preset === 'custom') {
    const from = customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const to = customTo ? new Date(`${customTo}T23:59:59`) : now
    return { from, to }
  }
  if (preset === 'day') {
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
    const to = cap(new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59))
    return { from, to }
  }
  if (preset === 'week') {
    const diffToMonday = (anchor.getDay() + 6) % 7
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - diffToMonday)
    const to = cap(new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59))
    return { from, to }
  }
  if (preset === 'month') {
    const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
    const to = cap(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59))
    return { from, to }
  }
  const from = new Date(anchor.getFullYear(), 0, 1)
  const to = cap(new Date(anchor.getFullYear(), 11, 31, 23, 59, 59))
  return { from, to }
}

// Moves the anchor by one unit of the selected granularity, so "précédent/suivant" steps
// through days, weeks, months or years depending on which preset is active.
function shiftAnchor(preset: Preset, anchor: Date, dir: 1 | -1): Date {
  const d = new Date(anchor)
  if (preset === 'day') d.setDate(d.getDate() + dir)
  else if (preset === 'week') d.setDate(d.getDate() + dir * 7)
  else if (preset === 'month') d.setMonth(d.getMonth() + dir)
  else if (preset === 'year') d.setFullYear(d.getFullYear() + dir)
  return d
}

export default function DriverStats() {
  const { addToast } = useToasts()
  const [preset, setPreset] = useState<Preset>('week')
  const [anchor, setAnchor] = useState(() => new Date())
  const [customFrom, setCustomFrom] = useState(toDateInputValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
  const [customTo, setCustomTo] = useState(toDateInputValue(new Date()))
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const { from, to } = useMemo(() => presetRange(preset, anchor, customFrom, customTo), [preset, anchor, customFrom, customTo])

  // Starting from "today" every time a granularity button is clicked keeps navigation
  // predictable — précédent/suivant then step back/forward from there.
  const selectPreset = (p: Preset) => {
    setPreset(p)
    setAnchor(new Date())
  }

  const canGoNext = useMemo(() => {
    if (preset === 'custom') return false
    const nextAnchor = shiftAnchor(preset, anchor, 1)
    const { from: nextFrom } = presetRange(preset, nextAnchor, customFrom, customTo)
    return nextFrom.getTime() <= new Date().getTime()
  }, [preset, anchor, customFrom, customTo])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const r = await getDriverStats(from.toISOString(), to.toISOString())
        if (!cancelled) setStats(r.data)
      } catch (e: any) {
        if (!cancelled) addToast({ message: e?.response?.data?.detail || 'Erreur lors du chargement des statistiques', tone: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from.getTime(), to.getTime()])

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      const resp = await downloadDriverReport(from.toISOString(), to.toISOString())
      const url = window.URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `bilan-${toDateInputValue(from)}_${toDateInputValue(to)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      addToast({ message: 'Erreur lors du téléchargement du bilan', tone: 'error' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={22} className="text-brand-600" />
        <h1 className="text-2xl font-bold text-stone-900">Espace chauffeur</h1>
      </div>
      <p className="text-stone-500 mb-6">Vos statistiques et votre bilan financier.</p>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-1.5 mb-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectPreset(opt.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                preset === opt.value ? 'bg-brand-500 text-white border-brand-500' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {preset !== 'custom' && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={() => setAnchor((a) => shiftAnchor(preset, a, -1))}
              title="Période précédente"
              className="grid place-items-center w-7 h-7 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-medium text-stone-700 min-w-[220px]">{formatPeriodLabel(preset, from, to)}</p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setAnchor((a) => shiftAnchor(preset, a, 1))}
              title="Période suivante"
              className="grid place-items-center w-7 h-7 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {preset === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 mt-3">
            <label className="text-sm">
              <div className="text-xs font-medium text-stone-500 mb-1">Du</div>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <div className="text-xs font-medium text-stone-500 mb-1">Au</div>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={toDateInputValue(new Date())}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm"
              />
            </label>
          </div>
        )}
      </Card>

      {loading ? (
        <div className="py-16 grid place-items-center">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="!p-4">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <RouteIcon size={14} />
                Distance parcourue
              </div>
              <div className="text-xl font-bold text-stone-900">{(stats?.total_distance_km ?? 0).toLocaleString('fr-FR')} km</div>
            </Card>
            <Card className="!p-4">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <Wallet size={14} />
                Montant gagné
              </div>
              <div className="text-xl font-bold text-secondary-700">{(stats?.total_earnings ?? 0).toLocaleString('fr-FR')} XOF</div>
            </Card>
            <Card className="!p-4">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <CheckCircle2 size={14} />
                Courses terminées
              </div>
              <div className="text-xl font-bold text-stone-900">{stats?.total_trips ?? 0}</div>
            </Card>
            <Card className="!p-4">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <TrendingUp size={14} />
                Prix moyen / course
              </div>
              <div className="text-xl font-bold text-stone-900">{(stats?.average_price ?? 0).toLocaleString('fr-FR')} XOF</div>
            </Card>
          </div>

          <Card className="mb-6">
            <h2 className="font-semibold text-stone-800 mb-3">Répartition des gains</h2>
            <MiniBarChart data={(stats?.breakdown ?? []).map((b) => ({ label: b.label, value: b.earnings }))} />
          </Card>

          <Button icon={<Download size={16} />} loading={downloading} onClick={handleDownloadPdf}>
            Télécharger le bilan (PDF)
          </Button>
        </>
      )}
    </div>
  )
}
