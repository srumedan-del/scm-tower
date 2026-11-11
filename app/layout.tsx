'use client'

import './globals.css'
import { useEffect, useState } from 'react'
import { Inter, Playfair_Display } from 'next/font/google'
import dynamic from 'next/dynamic'
import { FeedbackHost } from '@/components/ui/FeedbackHost'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  weight: ['500', '600'],
  variable: '--font-playfair',
})

const NumericFieldAdapter = dynamic(
  () => import('@/components/ui/NumericFieldAdapter'),
  { ssr: false }
)

export default function RootLayout({children}:{children:React.ReactNode}){
  return (
    <html lang="id" data-scroll-behavior="smooth" className={`${inter.variable} ${playfair.variable} ${inter.className}`}>
      <body className={inter.className}>
        <NumericFieldAdapter />
        {children}
        <FeedbackHost />
      </body>
    </html>
  )
}
