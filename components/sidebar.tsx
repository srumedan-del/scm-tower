'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeftRight, ChartNoAxesCombined, Database, DollarSign, LayoutDashboard, LogOut, Menu, Package, Settings, Truck, Warehouse, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const dashboard = ['Dashboard', '/dashboard', LayoutDashboard] as const
const groups = [
  { label: 'Operasional', items: [['Receiving', '/receiving', Package], ['Outbound', '/outbound', Truck], ['Crossdocking', '/crossdocking', ArrowLeftRight], ['Shipment', '/shipment', Truck], ['Shipment Cost', '/shipment-cost', DollarSign], ['Pengajuan Dana', '/shipment/budget-request', DollarSign]] },
  { label: 'Monitoring', items: [['Service Level', '/service-level', ChartNoAxesCombined], ['Inventory', '/inventory', Warehouse], ['Issue Log', '/issues', AlertTriangle]] },
  { label: 'Data & Sistem', items: [['Master Data', '/master-data', Database], ['Settings', '/settings', Settings]] },
] as const

type NavItem = readonly [string, string, typeof LayoutDashboard]

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const [label, href, Icon] = item
  const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
  return <Link href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-label-medium transition-all duration-150 ease-standard ${active ? 'bg-blue/10 font-medium text-brand-primary' : 'text-foreground-secondary hover:bg-background-tertiary hover:text-foreground-primary'}`}>
    <Icon size={17} className={active ? 'text-brand-primary' : 'text-foreground-tertiary'} /><span>{label}</span>
  </Link>
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <nav className="space-y-1" aria-label="Navigasi utama">
    <NavLink item={dashboard} pathname={pathname} onNavigate={onNavigate} />
    {groups.map(group => <section key={group.label}>
      <h2 className="px-3 pb-1.5 pt-3 text-caption font-medium uppercase tracking-wider text-foreground-tertiary">{group.label}</h2>
      <div className="space-y-0.5">{group.items.map(item => <NavLink key={item[1]} item={item} pathname={pathname} onNavigate={onNavigate} />)}</div>
    </section>)}
  </nav>
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  async function handleLogout() { await supabase.auth.signOut(); setMobileOpen(false); router.push('/login'); router.refresh() }
  const logout = <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-label-medium text-foreground-secondary hover:bg-red/5 hover:text-brand-red transition-all duration-150"><LogOut size={17} className="text-foreground-tertiary" /><span>Keluar</span></button>

  return <>
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-background-elevated p-4 md:flex shadow-level-1">
      <div className="mb-6 flex items-center gap-2.5 px-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-primary text-xs font-bold text-background-elevated">SC</span><div><span className="block text-title-medium text-foreground-primary">SCM Tower</span><span className="text-caption text-foreground-tertiary">Control Center</span></div></div>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1"><Navigation pathname={pathname} /></div><div className="mt-4 border-t border-border pt-4">{logout}</div>
    </aside>
    <button type="button" aria-label="Buka menu navigasi" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)} className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-lg border border-border bg-background-elevated text-foreground-primary shadow-level-1 md:hidden">
      <Menu size={20} />
    </button>
    {mobileOpen && <div className="fixed inset-0 z-50 md:hidden"><button type="button" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-foreground-primary/20 backdrop-blur-sm transition-opacity duration-200" />
      <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-background-elevated p-4 shadow-level-5 custom-scrollbar">
        <div className="mb-6 flex items-center justify-between px-3"><div className="flex items-center gap-2.5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-primary text-xs font-bold text-background-elevated">SC</span><span className="text-title-medium font-semibold">SCM Tower</span></div><button type="button" aria-label="Tutup menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-foreground-secondary hover:bg-background-tertiary transition-colors duration-150"><X size={20} /></button></div>
        <div className="flex-1 overflow-y-auto"><Navigation pathname={pathname} onNavigate={() => setMobileOpen(false)} /></div>
        <div className="mt-4 border-t border-border pt-4">{logout}</div>
      </aside>
    </div>}
  </>
}
