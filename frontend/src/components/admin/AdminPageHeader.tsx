import React from 'react'

/** Shared title/description/action header used at the top of every admin page. */
export default function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {description && <p className="text-stone-500 text-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}
