import React, { createContext, useCallback, useContext, useState } from 'react'

type Toast = { id: string; message: string; tone?: 'info' | 'success' | 'error' }

const ToastContext = createContext<{ addToast: (t: Omit<Toast, 'id'>) => void } | undefined>(undefined)

export function useToasts() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToasts must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 8)
    setToasts((s) => [...s, { id, ...t }])
    // auto dismiss
    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id))
    }, 4000)
  }, [])

  const remove = useCallback((id: string) => setToasts((s) => s.filter((t) => t.id !== id)), [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
        {toasts.map((t) => (
          <div key={t.id} className={`max-w-sm px-4 py-2 rounded shadow text-white ${t.tone === 'success' ? 'bg-green-600' : t.tone === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
            <div className="flex items-center justify-between">
              <div>{t.message}</div>
              <button className="ml-3 opacity-80" onClick={() => remove(t.id)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
