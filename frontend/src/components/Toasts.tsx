import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

type Tone = 'info' | 'success' | 'error'
type Toast = { id: string; message: string; tone?: Tone; leaving?: boolean }

const DURATION = 4500
const EXIT_MS = 280
// Caps how many toasts can stack on screen at once — a cascade of failed API calls shouldn't
// fill the viewport; older ones are dropped in favor of the newest.
const MAX_VISIBLE = 4

const ToastContext = createContext<{ addToast: (t: Omit<Toast, 'id'>) => void } | undefined>(undefined)

export function useToasts() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts must be used within ToastProvider')
  return ctx
}

const toneConfig: Record<Tone, { icon: typeof Info; iconBg: string; iconColor: string; bar: string }> = {
  success: { icon: CheckCircle2, iconBg: 'bg-secondary-50', iconColor: 'text-secondary-600', bar: 'bg-secondary-500' },
  error: { icon: XCircle, iconBg: 'bg-red-50', iconColor: 'text-red-600', bar: 'bg-red-500' },
  info: { icon: Info, iconBg: 'bg-brand-50', iconColor: 'text-brand-600', bar: 'bg-brand-500' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, { leave: ReturnType<typeof setTimeout>; remove?: ReturnType<typeof setTimeout> }>>({})

  const remove = useCallback((id: string) => {
    setToasts((s) => s.filter((t) => t.id !== id))
    delete timers.current[id]
  }, [])

  const beginLeave = useCallback(
    (id: string) => {
      setToasts((s) => s.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      if (timers.current[id]) clearTimeout(timers.current[id].leave)
      const removeTimer = setTimeout(() => remove(id), EXIT_MS)
      timers.current[id] = { ...timers.current[id], remove: removeTimer }
    },
    [remove],
  )

  const addToast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = String(Date.now()) + Math.random().toString(36).slice(2, 8)
      setToasts((s) => {
        const next = [...s, { id, ...t }]
        // Force out the oldest ones over the cap immediately, rather than animating them —
        // a burst of toasts means the newest is what the user needs to see right now.
        const overflow = next.length - MAX_VISIBLE
        if (overflow <= 0) return next
        next.slice(0, overflow).forEach((old) => {
          clearTimeout(timers.current[old.id]?.leave)
          clearTimeout(timers.current[old.id]?.remove)
          delete timers.current[old.id]
        })
        return next.slice(overflow)
      })
      const leaveTimer = setTimeout(() => beginLeave(id), DURATION)
      timers.current[id] = { leave: leaveTimer }
    },
    [beginLeave],
  )

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-50 w-[calc(100vw-3rem)] max-w-sm" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const cfg = toneConfig[t.tone || 'info']
          const Icon = cfg.icon
          return (
            <div key={t.id} className={`relative overflow-hidden rounded-2xl bg-white shadow-floating border border-stone-100 ${t.leaving ? 'animate-toast-out' : 'animate-toast-in'}`}>
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span className={`grid place-items-center w-8 h-8 rounded-xl shrink-0 ${cfg.iconBg} ${cfg.iconColor}`}>
                  <Icon size={18} />
                </span>
                <div className="text-sm text-stone-700 leading-snug pt-1 flex-1 min-w-0">{t.message}</div>
                <button className="shrink-0 grid place-items-center w-6 h-6 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors" onClick={() => beginLeave(t.id)} aria-label="Fermer">
                  <X size={14} />
                </button>
              </div>
              <div className="h-1 bg-stone-100">
                <div className={`h-full ${cfg.bar} animate-toast-progress origin-left`} style={{ animationDuration: `${DURATION}ms`, animationPlayState: t.leaving ? 'paused' : 'running' }} />
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
