import React from 'react'

export default function Card({
  children,
  className = '',
  padded = true,
}: {
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div className={`bg-white rounded-xl2 shadow-card border border-stone-100 ${padded ? 'p-5' : ''} ${className}`}>
      {children}
    </div>
  )
}
