import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import NumericFieldAdapter from '@/components/ui/NumericFieldAdapter'
import AppHealthMonitor from '@/components/monitor/AppHealthMonitor'

export const metadata: Metadata = { title: 'SCM Control Tower', description: 'SCM dashboard and operations app' }

/**
 * SF Pro is a proprietary Apple typeface and is not installed on Windows.
 * Inter is the closest freely-licensed, metric-compatible substitute and is
 * self-hosted by next/font (no external request, identical rendering for
 * every operator). The CSS font stack still prefers real SF Pro when the
 * machine happens to have it (macOS / iOS).
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="id" data-scroll-behavior="smooth" suppressHydrationWarning className={inter.variable}>
      <body>
        <NumericFieldAdapter />
        <AppHealthMonitor />
        {children}
      </body>
    </html>
  )
}
