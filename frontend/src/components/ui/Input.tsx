import React from 'react'

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  error?: string
  icon?: React.ReactNode
  hint?: string
}

export default function Input({ label, error, icon, hint, className = '', id, ...rest }: Props) {
  const inputId = id || rest.name
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">{icon}</span>}
        <input
          id={inputId}
          className={`w-full rounded-xl border bg-white dark:bg-stone-900 px-3.5 py-2.5 text-sm text-stone-900 dark:text-stone-50 placeholder:text-stone-400 dark:placeholder:text-stone-500 outline-none transition-shadow focus:ring-2 focus:ring-brand-400/40 focus:border-brand-400 ${
            icon ? 'pl-9' : ''
          } ${error ? 'border-red-400' : 'border-stone-200 dark:border-stone-700'} ${className}`}
          {...rest}
        />
      </div>
      {hint && !error && <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
