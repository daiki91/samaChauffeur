import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gift, PartyPopper, X } from 'lucide-react'

type Checkpoint = { km: number; discount_pct: number | null }

type Props = {
  checkpoints: Checkpoint[] | null
  onClose: () => void
}

const CONFETTI_COLORS = ['#f2590e', '#1f9d65', '#de9a1f', '#f6b93b', '#71220e']
const AUTO_ADVANCE_MS = 3200

function Confetti() {
  // Randomized once per mount — regenerating on every render would make the burst look static.
  const pieces = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        duration: 1.1 + Math.random() * 0.9,
        delay: Math.random() * 0.25,
        size: 5 + Math.random() * 4,
        round: Math.random() > 0.5,
      })),
    [],
  )
  return (
    <div className="pointer-events-none absolute inset-x-0 -top-2 h-36 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 animate-confetti"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.4,
            backgroundColor: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            borderRadius: p.round ? 9999 : 2,
          }}
        />
      ))}
    </div>
  )
}

// Quick, non-blocking festive toast shown on the dashboard right after a trip completes and
// crosses one or more distance-progression checkpoints (rewards.service.ts). Auto-advances
// through multiple checkpoints (a single long ride can cross more than one) and auto-dismisses
// — a passenger shouldn't have to click through a dialog just to see they rolled the dice.
export default function CheckpointCelebrationModal({ checkpoints, onClose }: Props) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [checkpoints])

  useEffect(() => {
    if (!checkpoints || checkpoints.length === 0) return
    const isLast = index === checkpoints.length - 1
    const id = setTimeout(() => {
      if (isLast) onClose()
      else setIndex((i) => i + 1)
    }, AUTO_ADVANCE_MS)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkpoints, index])

  if (!checkpoints || checkpoints.length === 0) return null
  const current = checkpoints[index]
  const won = current.discount_pct != null

  return (
    <div className="fixed inset-x-0 top-4 sm:top-6 z-[1000] flex justify-center px-4 pointer-events-none">
      <div key={index} className="relative pointer-events-auto bg-white rounded-2xl shadow-floating w-full max-w-sm p-5 text-center animate-fade-in-up">
        <Confetti />
        <button onClick={onClose} className="absolute right-3 top-3 text-stone-400 hover:text-stone-600" aria-label="Fermer">
          <X size={16} />
        </button>

        <span className={`relative mx-auto grid place-items-center w-14 h-14 rounded-2xl mb-3 animate-checkpoint-pop ${won ? 'bg-secondary-500 text-white' : 'bg-brand-50 text-brand-500'}`}>{won ? <Gift size={24} /> : <PartyPopper size={24} />}</span>

        <h3 className="text-base font-semibold text-stone-900">Checkpoint atteint à {current.km.toFixed(0)} km !</h3>
        <p className="mt-1 text-sm text-stone-500">
          {won ? (
            <>
              Vous avez gagné <span className="font-semibold text-secondary-600">-{current.discount_pct}%</span> sur votre prochaine course.
            </>
          ) : (
            'Pas de cadeau cette fois — la route continue !'
          )}
        </p>

        {checkpoints.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1">
            {checkpoints.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-4 bg-brand-500' : 'w-1.5 bg-stone-200'}`} />
            ))}
          </div>
        )}

        <Link to="/rewards" onClick={onClose} className="mt-3 inline-block text-xs font-medium text-stone-400 hover:text-brand-600">
          Voir ma progression
        </Link>
      </div>
    </div>
  )
}
