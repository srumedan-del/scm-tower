'use client'

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  hint?: string
  error?: string
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  hint?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, ...props }, ref) => (
    <label className="block">
      {label && <span className="text-xs font-bold text-text mb-1.5 block">{label}</span>}
      <input
        ref={ref}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-all
          border-border bg-white
          focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue
          disabled:bg-gray-50 disabled:text-muted disabled:cursor-not-allowed
          ${error ? 'border-red/50 focus:ring-red/20 focus:border-red' : ''}
          hover:border-gray-300
          ${className ?? ''}
        `}
        {...props}
      />
      {error && <span className="text-xs text-red mt-1 block">{error}</span>}
      {hint && !error && <span className="text-xs text-muted mt-1 block">{hint}</span>}
    </label>
  )
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, ...props }, ref) => (
    <label className="block">
      {label && <span className="text-xs font-bold text-text mb-1.5 block">{label}</span>}
      <textarea
        ref={ref}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-all
          border-border bg-white
          focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue
          disabled:bg-gray-50 disabled:text-muted disabled:cursor-not-allowed
          ${error ? 'border-red/50 focus:ring-red/20 focus:border-red' : ''}
          hover:border-gray-300
          resize-none
          ${className ?? ''}
        `}
        {...props}
      />
      {error && <span className="text-xs text-red mt-1 block">{error}</span>}
      {hint && !error && <span className="text-xs text-muted mt-1 block">{hint}</span>}
    </label>
  )
)
Textarea.displayName = 'Textarea'

type SelectProps = InputHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
  error?: string
  options?: { value: string | number; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, options, className, ...props }, ref) => (
    <label className="block">
      {label && <span className="text-xs font-bold text-text mb-1.5 block">{label}</span>}
      <select
        ref={ref}
        className={`w-full px-3 py-2.5 border rounded-lg text-sm transition-all
          border-border bg-white
          focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue
          disabled:bg-gray-50 disabled:text-muted disabled:cursor-not-allowed
          ${error ? 'border-red/50 focus:ring-red/20 focus:border-red' : ''}
          hover:border-gray-300
          appearance-none
          ${className ?? ''}
        `}
        {...props}
      >
        {options?.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red mt-1 block">{error}</span>}
      {hint && !error && <span className="text-xs text-muted mt-1 block">{hint}</span>}
    </label>
  )
)
Select.displayName = 'Select'
