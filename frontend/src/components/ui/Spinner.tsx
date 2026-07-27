export default function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-stone-200 dark:border-stone-700 border-t-brand-500 animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  )
}
