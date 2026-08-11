import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import StarRating from './ui/StarRating'
import Button from './ui/Button'

type Props = {
  driverName?: string
  onRate: (rating: number, comment?: string) => Promise<void> | void
  onSkip: () => Promise<void> | void
  submitting: boolean
}

const MAX_COMMENT_LENGTH = 500

export default function RatingCard({ driverName, onRate, onSkip, submitting }: Props) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [skipping, setSkipping] = useState(false)

  const handleSkip = async () => {
    setSkipping(true)
    try {
      await onSkip()
    } finally {
      setSkipping(false)
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent-300/20 via-white to-white border border-accent-300/30 px-5 py-5 mb-4 animate-fade-in-up">
      <h3 className="font-semibold text-stone-900 mb-1 text-center">{driverName ? `Comment était votre trajet avec ${driverName} ?` : 'Comment était votre trajet ?'}</h3>
      <p className="text-xs text-stone-500 text-center mb-4">Votre avis aide les autres passagers.</p>

      <div className="flex justify-center mb-1.5">
        <StarRating
          value={rating}
          label="Note du chauffeur"
          onChange={(n) => {
            setRating(n)
            setShowComment(true)
          }}
          size={34}
        />
      </div>
      {rating === 0 && <p className="text-xs text-stone-400 text-center mb-2">Sélectionnez une note pour continuer</p>}

      {showComment && (
        <div className="mb-3 animate-fade-in-up">
          <div className="relative">
            <MessageSquare size={14} className="absolute left-3 top-3 text-stone-300" />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              placeholder="Un commentaire (facultatif)"
              rows={2}
              maxLength={MAX_COMMENT_LENGTH}
              aria-label="Commentaire sur le trajet"
              className="w-full resize-none rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
            />
          </div>
          <p className="mt-1 text-right text-[11px] text-stone-400">
            {comment.length}/{MAX_COMMENT_LENGTH}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="!text-stone-400" onClick={handleSkip} disabled={submitting || skipping} loading={skipping} title="Ne plus demander pour ce trajet">
          Plus tard
        </Button>
        <Button fullWidth size="sm" disabled={rating === 0 || skipping} loading={submitting} onClick={() => onRate(rating, comment.trim() || undefined)}>
          Envoyer la note
        </Button>
      </div>
    </div>
  )
}
