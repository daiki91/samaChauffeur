import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Gift, MapPin, Sparkles, RotateCw } from 'lucide-react'
import { useRewards } from '../../context/RewardsContext'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Reveal from '../../components/ui/Reveal'
import Spinner from '../../components/ui/Spinner'
import AnimatedNumber from '../../components/ui/AnimatedNumber'
import RewardsProgress from '../../components/RewardsProgress'

export default function Rewards() {
  const navigate = useNavigate()
  const { status, loading, error, refresh } = useRewards()

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-800 mb-4 transition-colors">
        <ArrowLeft size={16} />
        Retour
      </button>

      {loading && !status ? (
        <div className="min-h-[40vh] grid place-items-center">
          <Spinner size={28} />
        </div>
      ) : !status ? (
        <div className="min-h-[30vh] flex flex-col items-center justify-center text-center gap-3">
          <p className="text-sm text-stone-500">{error ? 'Impossible de charger votre progression pour le moment.' : 'Aucune progression pour le moment.'}</p>
          {error && (
            <Button variant="outline" size="sm" icon={<RotateCw size={14} />} onClick={refresh} loading={loading}>
              Réessayer
            </Button>
          )}
        </div>
      ) : (
        <>
          <Reveal variant="fade">
            <div className="relative overflow-hidden rounded-3xl bg-hero-gradient text-white px-6 py-6 sm:py-7 mb-6">
              <div className="pointer-events-none absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 animate-float-slow" />
              <div className="pointer-events-none absolute -left-6 -bottom-10 w-36 h-36 rounded-full bg-white/10 animate-float" />
              <h1 className="relative text-2xl font-bold mb-1 flex items-center gap-2">
                <Gift size={22} className="animate-wave" />
                Cadeaux de route
              </h1>
              <p className="relative text-white/80 mb-5">Chaque km parcouru vous rapproche d'un prochain checkpoint.</p>
              <div className="relative text-4xl font-bold tabular-nums">
                <AnimatedNumber value={status.total_distance_km} format={(n) => n.toLocaleString('fr-FR')} />
                <span className="text-lg font-medium text-white/70 ml-1.5">km parcourus</span>
              </div>
              <div className="relative mt-4 bg-white/10 rounded-2xl p-3">
                <RewardsProgress totalDistanceKm={status.total_distance_km} lastCheckpointKm={status.last_checkpoint_km} nextCheckpointKm={status.next_checkpoint_km} />
              </div>
            </div>
          </Reveal>

          {status.pending_discount && (
            <Reveal variant="up" delay={60}>
              <Card className="mb-6 border-secondary-200 bg-secondary-50 transition-shadow duration-300 hover:shadow-floating">
                <h2 className="font-semibold text-stone-800 mb-1 flex items-center gap-2">
                  <Gift size={16} className="text-secondary-600" />
                  Réduction active
                </h2>
                <p className="text-sm text-stone-600">
                  <span className="font-bold text-secondary-700">-{status.pending_discount.pct}%</span> — {status.pending_discount.label} — sera appliquée automatiquement à votre prochaine course.
                </p>
              </Card>
            </Reveal>
          )}

          <Reveal variant="up" delay={100}>
            <Card className="mb-6 transition-shadow duration-300 hover:shadow-floating">
              <h2 className="font-semibold text-stone-800 mb-1 flex items-center gap-2">
                <Sparkles size={16} className="text-brand-600" />
                Comment ça marche ?
              </h2>
              <p className="text-sm text-stone-500">Chaque kilomètre parcouru avec samaChauffeur vous rapproche d'un checkpoint — le premier dès votre 1er km, puis les suivants apparaissent de façon aléatoire, un peu plus loin à chaque fois. Certains checkpoints cachent une réduction sur votre prochaine course, d'autres non — la seule façon de savoir, c'est de continuer à rouler !</p>
            </Card>
          </Reveal>

          <Reveal variant="up" delay={140}>
            <Card padded={false} className="transition-shadow duration-300 hover:shadow-floating">
              <div className="px-5 py-4 border-b border-stone-100">
                <h2 className="font-semibold text-stone-800">Historique des checkpoints</h2>
              </div>
              {status.history.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 text-stone-400">
                  <span className="grid place-items-center w-12 h-12 rounded-2xl bg-stone-50 mb-3">
                    <MapPin size={22} />
                  </span>
                  <p className="text-sm">Aucun checkpoint atteint pour l'instant.</p>
                  <p className="text-xs mt-1 max-w-xs">Le premier arrive dès votre 1er kilomètre parcouru !</p>
                </div>
              ) : (
                <ul className="divide-y divide-stone-100 px-5">
                  {status.history.map((h, i) => (
                    <li key={`${h.km}-${h.created_at}`} className="py-3 flex items-center justify-between gap-3 animate-fade-in-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${h.discount_pct != null ? 'bg-secondary-50 text-secondary-600' : 'bg-stone-50 text-stone-400'}`}>
                          <Gift size={15} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-stone-800">Checkpoint à {h.km.toFixed(0)} km</div>
                          <div className="text-xs text-stone-400 mt-0.5">{new Date(h.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 rounded-full px-2.5 py-1 ${h.discount_pct != null ? 'bg-secondary-100 text-secondary-700' : 'bg-stone-100 text-stone-400'}`}>{h.discount_pct != null ? `-${h.discount_pct}%` : 'Pas de chance'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
        </>
      )}
    </div>
  )
}
