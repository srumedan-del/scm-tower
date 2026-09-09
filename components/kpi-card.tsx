'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'

type Tone = 'blue' | 'green' | 'orange' | 'red'

const toneBg: Record<Tone, string> = {
  blue:   'bg-blue/10 text-blue',
  green:  'bg-green/10 text-green',
  orange: 'bg-orange/10 text-orange',
  red:    'bg-red/10 text-red',
}

const toneGlow: Record<Tone, string> = {
  blue:   'group-hover:shadow-blue/15',
  green:  'group-hover:shadow-green/15',
  orange: 'group-hover:shadow-orange/15',
  red:    'group-hover:shadow-red/15',
}

const toneIcon: Record<Tone, string> = {
  blue:   'text-blue/15',
  green:  'text-green/15',
  orange: 'text-orange/15',
  red:    'text-red/15',
}

type KpiCardProps = {
  title: string
  value: string | number
  caption?: string
  tone?: Tone
  icon?: ReactNode
  trend?: 'up' | 'down'
  trendValue?: string
  index?: number
}

export function KpiCard({
  title,
  value,
  caption,
  tone = 'blue',
  icon,
  trend,
  trendValue,
  index = 0,
}: KpiCardProps) {
  return (
    <motion.div
      className={`group bg-white border border-border rounded-xl p-5 relative overflow-hidden
        hover:shadow-lg ${toneGlow[tone]} transition-shadow duration-300 cursor-default`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.35,
        delay: index * 0.07,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
    >
      {/* Background icon dekoratif */}
      {icon && (
        <div className={`absolute -top-1 -right-1 ${toneIcon[tone]} opacity-60 scale-[2.5] pointer-events-none`}>
          {icon}
        </div>
      )}

      <div className="flex items-start justify-between mb-3 relative z-10">
        <span className="text-xs font-bold text-muted uppercase tracking-wide">{title}</span>
      </div>

      <motion.div
        className={`inline-block px-3 py-1.5 rounded-lg text-2xl font-bold ${toneBg[tone]}`}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.07 + 0.15, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        {value ?? '-'}
      </motion.div>

      <div className="mt-4 flex items-center justify-between relative z-10">
        {caption && <p className="text-xs text-muted">{caption}</p>}
        {trend && trendValue && (
          <motion.div
            className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green' : 'text-red'}`}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.07 + 0.25, duration: 0.25 }}
          >
            {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trendValue}
          </motion.div>
        )}
      </div>

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500
        bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rounded-xl" />
    </motion.div>
  )
}

