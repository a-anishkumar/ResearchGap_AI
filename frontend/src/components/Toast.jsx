import { useState, useCallback, useRef, useEffect, createContext, useContext } from 'react'

const ToastContext = createContext(null)

export function useToast() {
  return useContext(ToastContext)
}

const ICONS = {
  success: '✅',
  error:   '❌',
  info:    'ℹ️',
  warning: '⚠️',
}

const COLORS = {
  success: 'border-green-700/50 bg-green-950/60',
  error:   'border-red-700/50 bg-red-950/60',
  info:    'border-brand-700/50 bg-brand-950/60',
  warning: 'border-amber-700/50 bg-amber-950/60',
}

function ToastItem({ id, message, type = 'info', onDismiss }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss(id), 300)
  }

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl text-sm font-medium
        transition-all duration-300 ease-out shadow-lg cursor-pointer
        ${COLORS[type] || COLORS.info}
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}
      `}
      onClick={handleDismiss}
    >
      <span className="text-base shrink-0 mt-px">{ICONS[type]}</span>
      <p className="text-slate-200 leading-snug flex-1">{message}</p>
      <button
        onClick={(e) => { e.stopPropagation(); handleDismiss() }}
        className="text-slate-500 hover:text-slate-300 text-lg leading-none ml-1 shrink-0"
      >
        ×
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const toast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Convenience methods
  toast.success = (msg, dur) => toast(msg, 'success', dur)
  toast.error   = (msg, dur) => toast(msg, 'error', dur ?? 6000)
  toast.info    = (msg, dur) => toast(msg, 'info', dur)
  toast.warning = (msg, dur) => toast(msg, 'warning', dur)

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast portal */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
