import React from 'react'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'SCM Tower Driver',
  description: 'Portal Pelacakan & Pengiriman Driver SCM Tower',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // cover: halaman boleh sampai ke tepi layar; header dan menu bawah menambah jarak aman sendiri.
  viewportFit: 'cover',
  // Keyboard HP mengecilkan layout, jadi tombol di bawah tidak tertutup.
  interactiveWidget: 'resizes-content',
  // Sama dengan warna header agar status bar menyatu.
  themeColor: '#16302A',
}

export default function DriverMobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="driver-shell min-h-dvh bg-[#E9E5DC] text-[#17201C] flex flex-col">
      {/* Mobile container centered on larger screens */}
      <main className="w-full max-w-md mx-auto flex-1 flex flex-col bg-[#F6F4EF] shadow-xl relative min-h-dvh">
        {children}
      </main>
    </div>
  )
}
