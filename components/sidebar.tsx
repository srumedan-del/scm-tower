'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import {
  AlertTriangle, ArrowLeftRight, ChartNoAxesCombined, CheckSquare, Database, DollarSign, HandCoins,
  LayoutDashboard, LogOut, MapPin, Menu, Package, PackageOpen, Settings, Truck, Warehouse, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type NavItem = readonly [string, string, typeof LayoutDashboard]

const dashboard: NavItem = ['Dashboard', '/dashboard', LayoutDashboard]
const groups: readonly { label: string; items: readonly NavItem[] }[] = [
  { label: 'Workspace', items: [['Task Board', '/', CheckSquare], ['Peta & Stok HD', '/peta-stok-hd', MapPin]] },
  { label: 'Operasional', items: [['Receiving', '/receiving', Package], ['Outbound', '/outbound', PackageOpen], ['Crossdocking', '/crossdocking', ArrowLeftRight], ['Shipment', '/shipment', Truck], ['Shipment Cost', '/shipment-cost', DollarSign], ['Pengajuan Dana', '/shipment/budget-request', HandCoins]] },
  { label: 'Monitoring', items: [['Service Level', '/service-level', ChartNoAxesCombined], ['Inventory', '/inventory', Warehouse], ['Issue Log', '/issues', AlertTriangle]] },
  { label: 'Data & Sistem', items: [['Master Data', '/master-data', Database], ['Settings', '/settings', Settings]] },
]

const allHrefs = [dashboard[1], ...groups.flatMap(group => group.items.map(item => item[1]))]

/** Memilih menu paling spesifik agar /shipment-cost tidak ikut mengaktifkan /shipment. */
function findActiveHref(pathname: string) {
  return allHrefs
    .filter(href => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)))
    .sort((first, second) => second.length - first.length)[0]
}

function NavLink({ item, activeHref, indicatorId, onNavigate }: {
  item: NavItem
  activeHref: string | undefined
  indicatorId: string
  onNavigate?: () => void
}) {
  const [label, href, Icon] = item
  const active = activeHref === href
  return (
    <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className="lux-nav-link">
      {active && (
        <motion.span
          layoutId={indicatorId}
          className="lux-nav-active"
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        />
      )}
      <Icon size={17} aria-hidden="true" className="relative" />
      <span className="relative">{label}</span>
    </Link>
  )
}

function Navigation({ pathname, indicatorId, onNavigate }: { pathname: string; indicatorId: string; onNavigate?: () => void }) {
  const activeHref = findActiveHref(pathname)
  return (
    <nav className="space-y-0.5" aria-label="Navigasi utama">
      <NavLink item={dashboard} activeHref={activeHref} indicatorId={indicatorId} onNavigate={onNavigate} />
      {groups.map(group => (
        <section key={group.label}>
          <h2 className="lux-nav-heading">{group.label}</h2>
          <div className="space-y-0.5">
            {group.items.map(item => (
              <NavLink key={item[1]} item={item} activeHref={activeHref} indicatorId={indicatorId} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ))}
    </nav>
  )
}

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} title="Kembali ke Task Board" className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <span className="lux-brand-mark grid h-10 w-10 place-items-center rounded-xl text-xs font-bold tracking-wider">SC</span>
      <span>
        <span className="lux-display block text-lg font-semibold leading-tight text-white">SCM Tower</span>
        <span className="block text-[11px] uppercase tracking-[0.16em] text-gold-400">Control Center</span>
      </span>
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    setMobileOpen(false)
    router.push('/login')
    router.refresh()
  }

  const logout = (
    <button type="button" onClick={handleLogout} className="lux-nav-link w-full">
      <LogOut size={17} aria-hidden="true" />
      <span>Keluar</span>
    </button>
  )

  return (
    <MotionConfig reducedMotion="user">
      <aside className="lux-sidebar sticky top-0 hidden h-screen w-64 shrink-0 flex-col p-4 md:flex">
        <div className="mb-5"><Brand /></div>
        <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
          <Navigation pathname={pathname} indicatorId="nav-active-desktop" />
        </div>
        <div className="mt-4 border-t border-white/10 pt-3">{logout}</div>
      </aside>

      <button
        type="button"
        aria-label="Buka menu navigasi"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(true)}
        className="lux-brand-mark fixed left-3 top-3 z-40 grid h-11 w-11 place-items-center rounded-xl md:hidden"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-indigo-950/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: -32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="lux-sidebar relative flex h-full w-72 max-w-[85vw] flex-col p-4"
          >
            <div className="mb-5 flex items-center justify-between">
              <Brand onNavigate={() => setMobileOpen(false)} />
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMobileOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-lg text-white/80 transition-colors hover:bg-white/10"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto">
              <Navigation pathname={pathname} indicatorId="nav-active-mobile" onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="mt-4 border-t border-white/10 pt-3">{logout}</div>
          </motion.aside>
        </div>
      )}
    </MotionConfig>
  )
}
