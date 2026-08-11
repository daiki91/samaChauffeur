import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** id of the element that labels this dialog, wired to aria-labelledby for screen readers. */
  labelledBy?: string
  /** Whether Escape / clicking the backdrop closes the modal. Set false while a critical
   *  action is submitting, same as disabling the Annuler/X buttons in that state. */
  dismissible?: boolean
  /** Bottom sheet on mobile, centered dialog from `sm` up — matches the existing pattern used
   *  by PaymentModal/TripDetailModal. Plain centered dialog (Account/SOS confirms) otherwise. */
  bottomSheet?: boolean
  maxWidth?: string
  showCloseButton?: boolean
  className?: string
  id?: string
}

// Shared modal shell: role="dialog" + aria-modal, Escape to close, backdrop click to close,
// a lightweight focus trap (Tab cycles within the dialog), and focus restored to whatever
// triggered the modal on close. Was previously duplicated ad hoc across PaymentModal,
// TripDetailModal, Account.tsx's delete-confirm, and RideStatusBar's SOS confirm.
export default function Modal({
  open,
  onClose,
  children,
  labelledBy,
  dismissible = true,
  bottomSheet = false,
  maxWidth = 'max-w-sm',
  showCloseButton = true,
  className = '',
  id,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (dismissible) onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus?.()
    }
  }, [open, dismissible, onClose])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 bg-stone-900/50 flex ${bottomSheet ? 'items-end sm:items-center' : 'items-center'} justify-center z-[1000] p-0 sm:p-4`}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`bg-white ${bottomSheet ? 'rounded-t-3xl sm:rounded-2xl' : 'rounded-2xl'} shadow-floating w-full ${maxWidth} p-6 relative animate-fade-in-up outline-none ${className}`}
      >
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Fermer"
            className="print:hidden absolute right-4 top-4 text-stone-400 hover:text-stone-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={18} />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
