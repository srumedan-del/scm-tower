'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { MotionConfig, motion } from 'framer-motion'
import {
  ArrowLeftRight, ChartNoAxesCombined, CheckSquare, ChevronDown, ClipboardList, Database, DollarSign,
  LayoutDashboard, LogOut, MapPin, Menu, Package, PackageOpen, PanelLeftClose, PanelLeftOpen, Radio, Truck, Warehouse, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getNavBadges, type NavBadges } from '@/app/(app)/nav-badges'

type NavItem = readonly [string, string, typeof LayoutDashboard]
/** Menu bertingkat: href induk dipakai sebagai awalan path dan tujuan saat sidebar diciutkan. */
type NavParent = { label: string; href: string; icon: typeof LayoutDashboard; collapsedHref: string; children: readonly NavItem[] }
type NavEntry = NavItem | NavParent
const isParent = (entry: NavEntry): entry is NavParent => !Array.isArray(entry)

const stockOpname: NavParent = {
  label: 'Stock Opname', href: '/inventory/opname', icon: ClipboardList, collapsedHref: '/inventory/opname/mingguan',
  children: [
    ['Harian', '/inventory/opname/harian', ClipboardList],
    ['Mingguan', '/inventory/opname/mingguan', ClipboardList],
    ['Bulanan', '/inventory/opname/bulanan', ClipboardList],
  ],
}

const dashboard: NavItem = ['Dashboard', '/dashboard', LayoutDashboard]
const groups: readonly { label: string; items: readonly NavEntry[] }[] = [
  { label: 'Workspace', items: [['Task Board', '/', CheckSquare], ['Peta & Stok HD', '/peta-stok-hd', MapPin], ['Live Tracking', '/live-tracking', Radio]] },
  { label: 'Operasional', items: [['Receiving', '/receiving', Package], ['Outbound', '/outbound', PackageOpen], ['Crossdocking', '/crossdocking', ArrowLeftRight], ['Shipment', '/shipment', Truck], ['Shipment Cost', '/shipment-cost', DollarSign]] },
  { label: 'Monitoring', items: [['Service Level', '/service-level', ChartNoAxesCombined], ['Inventory', '/inventory', Warehouse], stockOpname] },
  { label: 'Data & Sistem', items: [['Master Data', '/master-data', Database]] },
]

const BADGE_HINT: Record<string, string> = {
  '/shipment': 'PSS belum dibuatkan shipment bulan ini',
  '/crossdocking': 'PTS belum diputuskan lebih dari 2 hari kerja',
}

const COLLAPSE_KEY = 'scm-sidebar-collapsed'
const BADGE_REFRESH_MS = 5 * 60_000

const allHrefs = [dashboard[1], ...groups.flatMap(group => group.items.flatMap(item => isParent(item) ? [item.href, ...item.children.map(child => child[1])] : [item[1]]))]

/** Memilih menu paling spesifik agar /shipment-cost tidak ikut mengaktifkan /shipment. */
function findActiveHref(pathname: string) {
  return allHrefs
    .filter(href => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`)))
    .sort((first, second) => second.length - first.length)[0]
}

function NavLink({ item, activeHref, indicatorId, collapsed, badge, onNavigate, nested }: {
  item: NavItem
  nested?: boolean
  activeHref: string | undefined
  indicatorId: string
  collapsed: boolean
  badge?: number
  onNavigate?: () => void
}) {
  const [label, href, Icon] = item
  const active = activeHref === href
  const hint = badge ? `${label}: ${badge} ${BADGE_HINT[href] ?? 'menunggu'}` : label
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? hint : undefined}
      title={collapsed || badge ? hint : undefined}
      className={`lux-nav-link ${collapsed ? 'justify-center px-0' : ''} ${nested ? 'lux-nav-sub' : ''}`}
    >
      {active && (
        <motion.span
          layoutId={indicatorId}
          className="lux-nav-active"
          transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        />
      )}
      <span className={`relative ${nested ? 'hidden' : ''}`}>
        <Icon size={18} aria-hidden="true" />
        {collapsed && badge ? <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-gold-500 ring-2 ring-[#F0EEE6]" /> : null}
      </span>
      {!collapsed && <span className="relative flex-1 truncate">{label}</span>}
      {!collapsed && badge ? (
        <span className="relative rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold leading-none text-white">{badge}</span>
      ) : null}
    </Link>
  )
}

function NavParentLink({ parent, activeHref, indicatorId, collapsed, onNavigate }: {
  parent: NavParent
  activeHref: string | undefined
  indicatorId: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  const inside = activeHref === parent.href || parent.children.some(child => child[1] === activeHref)
  const [open, setOpen] = useState(inside)
  useEffect(() => { if (inside) setOpen(true) }, [inside])
  const Icon = parent.icon

  // Sidebar ciut: satu ikon menuju sub menu utama.
  if (collapsed) return <NavLink item={[parent.label, parent.collapsedHref, Icon]} activeHref={inside ? parent.collapsedHref : undefined} indicatorId={indicatorId} collapsed onNavigate={onNavigate} />

  return (
    <div>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="lux-nav-link w-full">
        {activeHref === parent.href && (
          <motion.span layoutId={indicatorId} className="lux-nav-active" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />
        )}
        <span className="relative"><Icon size={18} aria-hidden="true" /></span>
        <span className="relative flex-1 truncate text-left">{parent.label}</span>
        <ChevronDown size={16} aria-hidden="true" className={`relative transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-0.5">
          {parent.children.map(child => (
            <NavLink key={child[1]} item={child} activeHref={activeHref} indicatorId={indicatorId} collapsed={false} onNavigate={onNavigate} nested />
          ))}
        </div>
      )}
    </div>
  )
}

function Navigation({ pathname, indicatorId, collapsed, badges, onNavigate }: {
  pathname: string
  indicatorId: string
  collapsed: boolean
  badges: NavBadges
  onNavigate?: () => void
}) {
  const activeHref = findActiveHref(pathname)
  const link = (item: NavEntry) => isParent(item)
    ? <NavParentLink key={item.href} parent={item} activeHref={activeHref} indicatorId={indicatorId} collapsed={collapsed} onNavigate={onNavigate} />
    : <NavLink key={item[1]} item={item} activeHref={activeHref} indicatorId={indicatorId} collapsed={collapsed} badge={badges[item[1]]} onNavigate={onNavigate} />
  return (
    <nav className="space-y-0.5" aria-label="Navigasi utama">
      {link(dashboard)}
      {groups.map(group => (
        <section key={group.label}>
          {collapsed
            ? <div className="mx-auto my-3 h-px w-6 bg-black/10" aria-hidden="true" />
            : <h2 className="lux-nav-heading">{group.label}</h2>}
          <div className="space-y-0.5">{group.items.map(link)}</div>
        </section>
      ))}
    </nav>
  )
}

function Brand({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/" onClick={onNavigate} title="Kembali ke Task Board" className={`flex items-center gap-3 rounded-xl py-1.5 ${collapsed ? 'justify-center px-0' : 'px-2'}`}>
      <span className="lux-brand-mark grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold tracking-wider">SC</span>
      {!collapsed && (
        <span>
          <span className="lux-display block text-lg font-bold leading-tight text-indigo-900">SCM Tower</span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-600">Control Center</span>
        </span>
      )}
    </Link>
  )
}

function useNavBadges(pathname: string) {
  const [badges, setBadges] = useState<NavBadges>({})
  const lastLoad = useRef(0)
  const load = useCallback(() => {
    lastLoad.current = Date.now()
    return getNavBadges().then(setBadges).catch(() => {})
  }, [])
  useEffect(() => {
    void load()
    const timer = window.setInterval(load, BADGE_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])
  // Muat ulang setelah pindah halaman (mis. setelah membuat shipment), paling sering sekali per menit.
  useEffect(() => {
    if (Date.now() - lastLoad.current < 60_000) return
    const timer = window.setTimeout(load, 1500)
    return () => window.clearTimeout(timer)
  }, [pathname, load])
  return badges
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const badges = useNavBadges(pathname)

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1') } catch {}
  }, [])

  function toggleCollapsed() {
    setCollapsed(current => {
      const next = !current
      try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setMobileOpen(false)
    router.push('/login')
    router.refresh()
  }

  const logout = (isCollapsed: boolean) => (
    <button type="button" onClick={handleLogout} title={isCollapsed ? 'Keluar' : undefined} aria-label={isCollapsed ? 'Keluar' : undefined} className={`lux-nav-link w-full ${isCollapsed ? 'justify-center px-0' : ''}`}>
      <LogOut size={18} aria-hidden="true" />
      {!isCollapsed && <span>Keluar</span>}
    </button>
  )

  return (
    <MotionConfig reducedMotion="user">
      <aside className={`lux-sidebar sticky top-0 hidden h-screen shrink-0 flex-col p-3 transition-[width] duration-300 md:flex ${collapsed ? 'w-[4.75rem]' : 'w-64'}`}>
        <div className="mb-4"><Brand collapsed={collapsed} /></div>
        <div className="custom-scrollbar flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
          <Navigation pathname={pathname} indicatorId="nav-active-desktop" collapsed={collapsed} badges={badges} />
        </div>
        <div className="mt-3 space-y-0.5 border-t border-black/10 pt-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar'}
            title={collapsed ? 'Lebarkan sidebar' : 'Ciutkan sidebar'}
            className={`lux-nav-link w-full ${collapsed ? 'justify-center px-0' : ''}`}
          >
            {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
            {!collapsed && <span>Ciutkan</span>}
          </button>
          {logout(collapsed)}
        </div>
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
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
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
                className="grid h-11 w-11 place-items-center rounded-lg text-slate-600 transition-colors hover:bg-black/5"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="custom-scrollbar flex-1 overflow-y-auto">
              <Navigation pathname={pathname} indicatorId="nav-active-mobile" collapsed={false} badges={badges} onNavigate={() => setMobileOpen(false)} />
            </div>
            <div className="mt-4 border-t border-black/10 pt-3">{logout(false)}</div>
          </motion.aside>
        </div>
      )}
    </MotionConfig>
  )
}
