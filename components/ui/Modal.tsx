'use client'

import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'success' | 'error' | 'info'
}

const typeConfig = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-600',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    icon: 'text-red-600',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-600',
  },
}

export function Modal({ isOpen, onClose, title, message, type = 'info' }: ModalProps) {
  if (!isOpen) return null

  const cfg = typeConfig[type]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-md bg-white sm:rounded-xl shadow-[var(--shadow-xl)] sm:m-0 m-0 border-t-4 border-t-blue sm:border-t-0 transition-interactive"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 flex-shrink-0 ${cfg.icon}`}>
              {type === 'success' ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : type === 'error' ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <Info className="h-6 w-6" />
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${cfg.text}`}>{title}</h3>
              <p className={`mt-1 text-sm ${cfg.text} opacity-90`}>{message}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={`flex-shrink-0 rounded-md p-1 ${cfg.text} hover:bg-gray-100 transition-interactive focus-ring`}
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
