export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800 ${className}`} />
}
