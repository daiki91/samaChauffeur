import { useState } from 'react'
import { Star } from 'lucide-react'

type Props = {
  value: number
  onChange?: (n: number) => void
  size?: number
  readOnly?: boolean
}

export default function StarRating({ value, onChange, size = 28, readOnly = false }: Props) {
  const [hovered, setHovered] = useState<number | null>(null)
  const display = hovered ?? value

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display
        return (
          <button key={n} type="button" disabled={readOnly} onMouseEnter={() => !readOnly && setHovered(n)} onClick={() => !readOnly && onChange?.(n)} className={`transition-transform duration-150 ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}`} aria-label={`${n} étoile${n > 1 ? 's' : ''}`}>
            <Star size={size} className={`transition-colors duration-150 ${filled ? 'text-accent-500' : 'text-stone-200'}`} fill={filled ? 'currentColor' : 'none'} />
          </button>
        )
      })}
    </div>
  )
}
