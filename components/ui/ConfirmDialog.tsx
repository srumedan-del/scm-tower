'use client'

import { ReactNode, useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  children?: ReactNode
}

const variantConfig = {
  danger: {
    iconBg: 'bg-red-100',
    iconText: 'text-red-600',
    confirmVariant: 'danger' as const,
  },
  warning: {
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    confirmVariant: 'primary' as const,
  },
  info: {
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600',
    confirmVariant: 'primary' as const,
  },
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'danger',
  children,
}: ConfirmDialogProps) {
  // ESC untuk menutup + lock scroll body saat dialog terbuka
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const cfg = variantConfig[variant]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-xl shadow-[var(--shadow-level-3)] overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {children ?? (
          <>
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full ${cfg.iconBg} flex items-center justify-center`}>
                  <AlertTriangle className={`h-5 w-5 ${cfg.iconText}`} />
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-semibold text-text">{title}</h2>
                  <p className="mt-1 text-sm text-muted">{message}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-shrink-0 p-1 rounded-md text-muted hover:bg-gray-100 transition-interactive focus-ring"
                  aria-label="Tutup"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50 border-t border-border">
              <Button variant="ghost" size="sm" onClick={onClose}>
                {cancelLabel}
              </Button>
              <Button variant={cfg.confirmVariant} size="sm" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}