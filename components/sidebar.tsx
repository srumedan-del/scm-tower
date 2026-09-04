'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  LayoutDashboard, Truck, Package, ClipboardCheck,
  AlertTriangle, Settings, Users, Warehouse, Activity,
  Database, LogOut,
} from 'lucide-react'

const items = [
  ['Dashboard',         '/dashboard',           LayoutDashboard],
  ['Workflow',          '/workflow',             Activity],
  ['Shipment',          '/shipment',             Truck],
  ['Receiving',         '/receiving',            Package],
  ['Outbound',          '/outbound',             Truck],
  ['Inventory',         '/inventory',            Warehouse],
  ['Checklist',         '/warehouse-checklist',  ClipboardCheck],
  ['Issue Log',         '/issues',               AlertTriangle],
  ['Master',            '/master-data',          Database],
  ['Settings',          '/settings',             Settings],
] as const

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-white border-r border-border min-h-screen p-4 hidden md:flex flex-col">
      <div className="font-bold text-xl mb-6">SCM Control Tower</div>

      <nav className="space-y-1 flex-1">
        {items.map(([label, href, Icon]) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-indigo-50 text-indigo-700 font-medium'
                  : 'hover:bg-surface text-gray-700'
              }`}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-4 flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
      >
        <LogOut size={18} />
        Keluar
      </button>
    </aside>
  )
}
