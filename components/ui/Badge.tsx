'use client'

import * as React from 'react'

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

export type BadgeTone =
  | 'neutral'
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'muted'

export type BadgeSize = 'sm' | 'md'

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  blue:    'bg-blue/10 text-blue',
  green:   'bg-green/10 text-green',
  orange:  'bg-orange/10 text-orange',
  red:     'bg-red/10 text-red',
  muted:   'bg-border/50 text-muted',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[11px] rounded',
  md: 'px-2 py-0.5 text-xs rounded-full',
}

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: BadgeSize
  children: React.ReactNode
}

export function Badge({ tone = 'neutral', size = 'md', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 font-medium whitespace-nowrap transition-interactive',
        toneStyles[tone],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/** Canonical SCM shipment status → tone mapping (single source of truth). */
export const SHIPMENT_STATUS_TONE: Record<string, BadgeTone> = {
  Draft:      'neutral',
  Dispatched: 'blue',
  'In Transit': 'orange',
  Delivered:  'green',
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'tone' | 'children'> {
  status: string
  /** Extra mapping for statuses outside the shipment lifecycle. */
  toneMap?: Record<string, BadgeTone>
}

export function StatusBadge({ status, toneMap, className, ...props }: StatusBadgeProps) {
  const tone =
    (toneMap ?? SHIPMENT_STATUS_TONE)[status] ??
    (status === 'In Progress' ? 'orange' : status === 'Open' ? 'blue' : 'neutral')
  return (
    <Badge tone={tone} className={className} {...props}>
      {status}
    </Badge>
  )
}
