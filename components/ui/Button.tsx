'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  icon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue text-white hover:bg-blue/90 active:bg-blue/80',
  secondary: 'border border-border bg-white text-text hover:bg-gray-50 active:bg-gray-100',
  ghost: 'text-text hover:bg-gray-50 active:bg-gray-100',
  danger: 'bg-red text-white hover:bg-red/90 active:bg-red/80',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-medium rounded-lg',
  md: 'px-4 py-2 text-sm font-medium rounded-lg',
  lg: 'px-6 py-3 text-base font-medium rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      disabled,
      children,
      className,
      ...props
    },
    ref
  ) => (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 transition-all
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none focus:ring-2 focus:ring-blue/30
        ${className ?? ''}
      `}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  )
)
Button.displayName = 'Button'

type ButtonGroupProps = {
  children: React.ReactNode
  layout?: 'horizontal' | 'vertical'
}

export function ButtonGroup({ children, layout = 'horizontal' }: ButtonGroupProps) {
  return (
    <div className={`flex gap-2 ${layout === 'vertical' ? 'flex-col' : 'flex-row'}`}>
      {children}
    </div>
  )
}
