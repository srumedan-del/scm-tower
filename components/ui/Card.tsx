'use client'

import * as React from 'react'

/**
 * UI/UX Pro Max design-system primitives.
 * Zero-dependency (no radix/clsx) so package.json stays untouched.
 */

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** Adds hover lift + border emphasis. Use only for clickable cards. */
  interactive?: boolean
}

export function Card({ className, children, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cx(
        'rounded-xl border border-border bg-white p-5 shadow-[var(--shadow-sm)]',
        'transition-interactive',
        interactive && 'cursor-interactive hover-lift hover:border-blue/30',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode
  action?: React.ReactNode
  children?: React.ReactNode
}

export function CardHeader({ className, title, action, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cx('mb-4 flex items-start justify-between gap-3 border-b border-border pb-3', className)}
      {...props}
    >
      {title ? <h3 className="text-sm font-semibold text-text">{title}</h3> : children}
      {action}
    </div>
  )
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return (
    <div className={cx('space-y-3', className)} {...props}>
      {children}
    </div>
  )
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={cx('mt-4 flex items-center justify-end gap-2 border-t border-border pt-3', className)}
      {...props}
    >
      {children}
    </div>
  )
}
