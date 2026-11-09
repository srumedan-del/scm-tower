import React from 'react'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'SCM Tower Driver',
  description: 'Portal Pelacakan & Pengiriman Driver SCM Tower',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0D1C33',
}

export default function DriverMobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#E9E5DC] text-[#111827] flex flex-col">
      {/* Mobile container centered on larger screens */}
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col bg-[#F7F5F0] shadow-xl relative min-h-screen">
        {children}
      </main>
    </div>
  )
}
