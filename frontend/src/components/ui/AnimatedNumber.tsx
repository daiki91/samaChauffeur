import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}

/** Animates numeric transitions (price estimates, counters) with an eased count-up/down. */
export default function AnimatedNumber({ value, duration = 500, format, className = '' }: Props) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const frameRef = useRef<number>()

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return

    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  const rounded = Math.round(display)
  return <span className={className}>{format ? format(rounded) : rounded}</span>
}
