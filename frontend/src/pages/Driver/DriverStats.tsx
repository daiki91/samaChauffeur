import { useEffect, useMemo, useState } from 'react'
import { getDriverStats, downloadDriverReport, getEarningsSummary, getMyPayouts, requestPayout } from '../../lib/driverApi'
import { useToasts } from '../../components/Toasts'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Spinner from '../../components/ui/Spinner'
import Reveal from '../../components/ui/Reveal'
import AnimatedNumber from '../../components/ui/AnimatedNumber'
import MiniBarChart from '../../components/admin/MiniBarChart'
import { BarChart3, Route as RouteIcon, Wallet, CheckCircle2, TrendingUp, Download, ChevronLeft, ChevronRight, ArrowDownToLine, Landmark, Inbox } from 'lucide-react'

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

type EarningsSummary = { total_earnings: number; total_paid_out: number; available_balance: number }

type Payout = { id: number; amount: number; status: 'SCHEDULED' | 'PROCESSED' | 'FAILED'; scheduled_at: string | null; processed_at: string | null }

const PAYOUT_STATUS: Record<Payout['status'], { label: string; className: string }> = {
  SCHEDULED: { label: 'En attente', className: 'bg-accent-300/40 text-accent-700' },
  PROCESSED: { label: 'Versé', className: 'bg-secondary-100 text-secondary-800' },
  FAILED: { label: 'Échoué', className: 'bg-red-100 text-red-700' },
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

  const [earnings, setEarnings] = useState<EarningsSummary | null>(null)
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [payoutFormOpen, setPayoutFormOpen] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [requestingPayout, setRequestingPayout] = useState(false)

  const refreshEarnings = () => {
    getEarningsSummary()
      .then((r) => setEarnings(r.data))
      .catch(() => {})
    getMyPayouts()
      .then((r) => setPayouts(r.data))
      .catch(() => {})
  }

  useEffect(() => {
    refreshEarnings()
  }, [])

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(payoutAmount)
    if (!amount || amount <= 0) return
    setRequestingPayout(true)
    try {
      await requestPayout(amount)
      addToast({ message: 'Demande de retrait envoyée — elle sera traitée par notre équipe.', tone: 'success' })
      setPayoutAmount('')
      setPayoutFormOpen(false)
      refreshEarnings()
    } catch (e: any) {
      addToast({ message: e?.response?.data?.detail || 'Erreur lors de la demande de retrait', tone: 'error' })
    } finally {
      setRequestingPayout(false)
    }
  }

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
    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 w-[32rem] h-64 rounded-full bg-brand-300/10 blur-3xl -z-10" />

      <Reveal variant="fade">
        <div className="flex items-center gap-3 mb-1">
          <span className="grid place-items-center w-10 h-10 rounded-xl bg-warm-gradient text-white shadow-card">
            <BarChart3 size={19} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 leading-tight">Espace chauffeur</h1>
            <p className="text-stone-500 text-sm">Vos statistiques et votre bilan financier.</p>
          </div>
        </div>
      </Reveal>

      <Reveal variant="up" delay={60}>
      <Card className="mt-6 mb-6 transition-shadow duration-300 hover:shadow-floating">
        <div className="flex flex-wrap gap-1.5 mb-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => selectPreset(opt.value)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 active:scale-95 ${
                preset === opt.value ? 'bg-brand-500 text-white border-brand-500 scale-105 shadow-card' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:scale-105'
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
      </Reveal>

      <Reveal variant="up" delay={100}>
      <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-stone-800 flex items-center gap-2">
            <Landmark size={16} className="text-brand-600" />
            Mes gains
          </h2>
          <Button size="sm" variant="outline" icon={<ArrowDownToLine size={14} />} disabled={!earnings || earnings.available_balance <= 0} onClick={() => setPayoutFormOpen((v) => !v)}>
            Demander un retrait
          </Button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mb-1">
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 transition-transform duration-200 hover:scale-[1.02]">
            <div className="text-xs text-stone-500 mb-1">Solde disponible</div>
            <div className="text-lg font-bold text-secondary-700">
              <AnimatedNumber value={earnings?.available_balance ?? 0} format={(n) => n.toLocaleString('fr-FR')} /> XOF
            </div>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 transition-transform duration-200 hover:scale-[1.02]">
            <div className="text-xs text-stone-500 mb-1">Total gagné (à vie)</div>
            <div className="text-lg font-bold text-stone-900">
              <AnimatedNumber value={earnings?.total_earnings ?? 0} format={(n) => n.toLocaleString('fr-FR')} /> XOF
            </div>
          </div>
          <div className="rounded-xl bg-stone-50 border border-stone-100 px-4 py-3 transition-transform duration-200 hover:scale-[1.02]">
            <div className="text-xs text-stone-500 mb-1">Déjà retiré</div>
            <div className="text-lg font-bold text-stone-900">
              <AnimatedNumber value={earnings?.total_paid_out ?? 0} format={(n) => n.toLocaleString('fr-FR')} /> XOF
            </div>
          </div>
        </div>

        {payoutFormOpen && (
          <form onSubmit={handleRequestPayout} className="mt-4 flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Montant à retirer (XOF)"
                type="number"
                min={1}
                max={earnings?.available_balance ?? undefined}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder={`Max ${(earnings?.available_balance ?? 0).toLocaleString('fr-FR')}`}
                autoFocus
              />
            </div>
            <Button type="submit" loading={requestingPayout} disabled={!payoutAmount || Number(payoutAmount) <= 0}>
              Envoyer
            </Button>
          </form>
        )}

        <div className="mt-5">
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Historique des retraits</h3>
          {payouts.length === 0 ? (
            <div className="flex flex-col items-center text-center py-6 text-stone-400">
              <span className="grid place-items-center w-10 h-10 rounded-2xl bg-stone-50 mb-2">
                <Inbox size={18} />
              </span>
              <p className="text-sm">Aucune demande de retrait pour l'instant.</p>
            </div>
          ) : (
            <ul className="divide-y divide-stone-100">
              {payouts.map((p, i) => (
                <li key={p.id} className="py-2.5 flex items-center justify-between gap-3 animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <div className="text-sm text-stone-700">
                    {p.amount.toLocaleString('fr-FR')} XOF
                    <span className="text-xs text-stone-400 ml-2">{p.processed_at ? new Date(p.processed_at).toLocaleDateString('fr-FR') : p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString('fr-FR') : ''}</span>
                  </div>
                  <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${PAYOUT_STATUS[p.status].className}`}>{PAYOUT_STATUS[p.status].label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      </Reveal>

      {loading ? (
        <div className="py-16 grid place-items-center">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <Reveal variant="up" delay={140}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="!p-4 transition-all duration-300 hover:shadow-floating hover:-translate-y-0.5">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <RouteIcon size={14} />
                Distance parcourue
              </div>
              <div className="text-xl font-bold text-stone-900">
                <AnimatedNumber value={stats?.total_distance_km ?? 0} format={(n) => n.toLocaleString('fr-FR')} /> km
              </div>
            </Card>
            <Card className="!p-4 transition-all duration-300 hover:shadow-floating hover:-translate-y-0.5">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <Wallet size={14} />
                Montant gagné
              </div>
              <div className="text-xl font-bold text-secondary-700">
                <AnimatedNumber value={stats?.total_earnings ?? 0} format={(n) => n.toLocaleString('fr-FR')} /> XOF
              </div>
            </Card>
            <Card className="!p-4 transition-all duration-300 hover:shadow-floating hover:-translate-y-0.5">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <CheckCircle2 size={14} />
                Courses terminées
              </div>
              <div className="text-xl font-bold text-stone-900">
                <AnimatedNumber value={stats?.total_trips ?? 0} />
              </div>
            </Card>
            <Card className="!p-4 transition-all duration-300 hover:shadow-floating hover:-translate-y-0.5">
              <div className="flex items-center gap-2 text-xs text-stone-500 mb-1.5">
                <TrendingUp size={14} />
                Prix moyen / course
              </div>
              <div className="text-xl font-bold text-stone-900">
                <AnimatedNumber value={stats?.average_price ?? 0} format={(n) => n.toLocaleString('fr-FR')} /> XOF
              </div>
            </Card>
          </div>
          </Reveal>

          <Reveal variant="up" delay={180}>
          <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
            <h2 className="font-semibold text-stone-800 mb-3">Répartition des gains</h2>
            <MiniBarChart data={(stats?.breakdown ?? []).map((b) => ({ label: b.label, value: b.earnings }))} />
          </Card>
          </Reveal>

          <Reveal variant="up" delay={220}>
          <Button icon={<Download size={16} />} loading={downloading} onClick={handleDownloadPdf}>
            Télécharger le bilan (PDF)
          </Button>
          </Reveal>
        </>
      )}
    </div>
  )
}
