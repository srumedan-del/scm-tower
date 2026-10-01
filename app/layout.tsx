import './globals.css'
import type { Metadata } from 'next'
import NumericFieldAdapter from '@/components/ui/NumericFieldAdapter'
import AppHealthMonitor from '@/components/monitor/AppHealthMonitor'

export const metadata: Metadata = { title: 'SCM Control Tower', description: 'SCM dashboard and operations app' }

export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="id" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <NumericFieldAdapter />
        <AppHealthMonitor />
        {children}
      </body>
    </html>
  )
}
