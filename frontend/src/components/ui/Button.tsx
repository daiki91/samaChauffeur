import React from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variantClasses: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 shadow-card disabled:bg-brand-300',
  secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 shadow-card disabled:bg-secondary-300',
  outline: 'bg-white text-brand-600 border border-brand-200 hover:bg-brand-50 disabled:text-brand-300',
  ghost: 'bg-transparent text-stone-700 hover:bg-stone-100 disabled:text-stone-300',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-card disabled:bg-red-300',
}

// Solid variants sit on a colored background so a white spinner reads fine; outline/ghost sit
// on white/transparent backgrounds where a white spinner would be invisible.
const spinnerClasses: Record<Variant, string> = {
  primary: 'border-white/40 border-t-white',
  secondary: 'border-white/40 border-t-white',
  danger: 'border-white/40 border-t-white',
  outline: 'border-brand-200 border-t-brand-600',
  ghost: 'border-stone-300 border-t-stone-600',
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

export default function Button({ variant = 'primary', size = 'md', loading = false, icon, fullWidth, className = '', children, disabled, ...rest }: Props) {
  return (
    <button className={`inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className={`h-4 w-4 rounded-full border-2 animate-spin ${spinnerClasses[variant]}`} /> : icon}
      {children}
    </button>
  )
}
