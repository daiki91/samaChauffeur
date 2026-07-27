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

export default function RatingCard({ driverName, onRate, onSkip, submitting }: Props) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)

  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent-300/20 dark:from-accent-400/10 via-white dark:via-stone-900 to-white dark:to-stone-900 border border-accent-300/30 dark:border-accent-400/20 px-5 py-5 mb-4 animate-fade-in-up">
      <h3 className="font-semibold text-stone-900 dark:text-stone-50 mb-1 text-center">
        {driverName ? `Comment était votre trajet avec ${driverName} ?` : 'Comment était votre trajet ?'}
      </h3>
      <p className="text-xs text-stone-500 dark:text-stone-400 text-center mb-4">Votre avis aide les autres passagers.</p>

      <div className="flex justify-center mb-3">
        <StarRating value={rating} onChange={(n) => { setRating(n); setShowComment(true) }} size={34} />
      </div>

      {showComment && (
        <div className="mb-3 animate-fade-in-up">
          <div className="relative">
            <MessageSquare size={14} className="absolute left-3 top-3 text-stone-300 dark:text-stone-600" />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Un commentaire (facultatif)"
              rows={2}
              maxLength={500}
              className="w-full resize-none rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 pl-9 pr-3 py-2.5 text-sm text-stone-700 dark:text-stone-200 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
            />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" className="!text-stone-400 dark:!text-stone-500" onClick={onSkip} disabled={submitting}>
          Plus tard
        </Button>
        <Button
          fullWidth
          size="sm"
          disabled={rating === 0}
          loading={submitting}
          onClick={() => onRate(rating, comment.trim() || undefined)}
        >
          Envoyer la note
        </Button>
      </div>
    </div>
  )
}
