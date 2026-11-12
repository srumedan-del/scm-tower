'use client'

import './globals.css'
import { Suspense, useEffect, useState } from 'react'
import { Inter } from 'next/font/google'
import dynamic from 'next/dynamic'
import { FeedbackHost } from '@/components/ui/FeedbackHost'
import { UploadProgressHost } from '@/components/ui/UploadProgressHost'
import { RouteProgress } from '@/components/ui/RouteProgress'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})


const NumericFieldAdapter = dynamic(
  () => import('@/components/ui/NumericFieldAdapter'),
  { ssr: false }
)

export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="id" data-scroll-behavior="smooth" className={inter.variable}>
      <body>
        <NumericFieldAdapter />
        {children}
        <FeedbackHost />
        <UploadProgressHost />
        <Suspense fallback={null}><RouteProgress /></Suspense>
      </body>
    </html>
  )
}
