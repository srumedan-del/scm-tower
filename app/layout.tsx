import './globals.css'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'SCM Control Tower', description: 'SCM dashboard and operations app' }
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}
