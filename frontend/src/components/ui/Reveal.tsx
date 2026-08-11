import React, { useEffect, useRef, useState } from 'react'

type Props = {
  children: React.ReactNode
  className?: string
  delay?: number
  as?: keyof JSX.IntrinsicElements
  variant?: 'up' | 'fade' | 'left' | 'right' | 'zoom'
}

const variantClasses: Record<NonNullable<Props['variant']>, string> = {
  up: 'translate-y-8 opacity-0',
  fade: 'opacity-0',
  left: '-translate-x-8 opacity-0',
  right: 'translate-x-8 opacity-0',
  zoom: 'scale-95 opacity-0',
}

/** Fades/slides children in the first time they cross the viewport (or immediately if already visible on mount). */
export default function Reveal({ children, className = '', delay = 0, as = 'div', variant = 'up' }: Props) {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const Tag = as as any

  return (
    <Tag
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'translate-y-0 translate-x-0 scale-100 opacity-100' : variantClasses[variant]} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  )
}
