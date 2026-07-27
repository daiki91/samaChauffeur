import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-card disabled:bg-brand-300 dark:disabled:bg-brand-800',
  secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 shadow-card disabled:bg-secondary-300 dark:disabled:bg-secondary-800',
  outline:
    'bg-white text-brand-600 border border-brand-200 hover:bg-brand-50 disabled:text-brand-300 dark:bg-stone-900 dark:border-brand-800 dark:hover:bg-brand-500/10 dark:disabled:text-brand-800',
  ghost: 'bg-transparent text-stone-700 hover:bg-stone-100 disabled:text-stone-300 dark:text-stone-300 dark:hover:bg-stone-800 dark:disabled:text-stone-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-card disabled:bg-red-300 dark:disabled:bg-red-900',
}

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-sm px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-base px-5 py-3 rounded-xl gap-2',
}

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: React.ReactNode
  fullWidth?: boolean
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth,
  className = '',
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  )
}
