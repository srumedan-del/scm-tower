'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Activity, AlertTriangle, ArrowLeftRight, ChartNoAxesCombined, Database, DollarSign, LayoutDashboard, LogOut, Menu, Package, Settings, Truck, Warehouse, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const dashboard = ['Dashboard', '/dashboard', LayoutDashboard] as const
const groups = [
  { label: 'Operasional', items: [['Workflow', '/workflow', Activity], ['Receiving', '/receiving', Package], ['Outbound', '/outbound', Truck], ['Crossdocking', '/crossdocking', ArrowLeftRight], ['Shipment', '/shipment', Truck], ['Shipment Cost', '/shipment-cost', DollarSign], ['Pengajuan Dana', '/shipment/budget-request', DollarSign]] },
  { label: 'Monitoring', items: [['Service Level', '/service-level', ChartNoAxesCombined], ['Inventory', '/inventory', Warehouse], ['Issue Log', '/issues', AlertTriangle]] },
  { label: 'Data & Sistem', items: [['Master Data', '/master-data', Database], ['Settings', '/settings', Settings]] },
] as const

type NavItem = readonly [string, string, typeof LayoutDashboard]

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const [label, href, Icon] = item
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return <Link href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? 'bg-blue/10 font-medium text-blue' : 'text-gray-600 hover:bg-gray-100 hover:text-text'}`}>
    <Icon size={17} className={active ? 'text-blue' : 'text-gray-400'} /><span>{label}</span>
  </Link>
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <nav className="space-y-4" aria-label="Navigasi utama">
    <NavLink item={dashboard} pathname={pathname} onNavigate={onNavigate} />
    {groups.map(group => <section key={group.label}>
      <h2 className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">{group.label}</h2>
      <div className="space-y-0.5">{group.items.map(item => <NavLink key={item[1]} item={item} pathname={pathname} onNavigate={onNavigate} />)}</div>
    </section>)}
  </nav>
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  async function handleLogout() { await supabase.auth.signOut(); setMobileOpen(false); router.push('/login'); router.refresh() }
  const logout = <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-red/5 hover:text-red"><LogOut size={17} className="text-gray-400" /><span>Keluar</span></button>

  return <>
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-white p-4 md:flex">
      <div className="mb-6 flex items-center gap-2.5 px-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue text-xs font-bold text-white">SC</span><div><span className="block text-sm font-semibold text-text">SCM Tower</span><span className="text-[10px] text-muted">Control Center</span></div></div>
      <div className="flex-1 overflow-y-auto pr-1"><Navigation pathname={pathname} /></div><div className="mt-3 border-t border-border pt-3">{logout}</div>
    </aside>
    <button type="button" aria-label="Buka menu navigasi" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-lg border border-border bg-white text-gray-700 shadow-sm md:hidden"><Menu size={20} /></button>
    {mobileOpen && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/40" />
      <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-white p-4 shadow-2xl"><div className="mb-6 flex items-center justify-between px-2"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue text-xs font-bold text-white">SC</span><span className="text-sm font-semibold">SCM Tower</span></div><button type="button" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} className="rounded p-2 text-gray-500 hover:bg-gray-100"><X size={20} /></button></div><div className="flex-1 overflow-y-auto"><Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} /></div><div className="mt-3 border-t border-border pt-3">{logout}</div></aside>
    </div>}
  </>
}
