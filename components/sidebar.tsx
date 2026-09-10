'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Truck, Package,
  AlertTriangle, Settings, Warehouse, Activity,
  Database, LogOut, ArrowLeftRight, DollarSign, ChartNoAxesCombined,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const items = [
  ['Dashboard',     '/dashboard',     LayoutDashboard],
  ['Workflow',      '/workflow',      Activity],
  ['Shipment',      '/shipment',      Truck],
  ['Service Level', '/service-level', ChartNoAxesCombined],
  ['Shipment Cost', '/shipment-cost', DollarSign],
  ['Receiving',     '/receiving',     Package],
  ['Outbound',      '/outbound',      Truck],
  ['Crossdocking',  '/crossdocking',  ArrowLeftRight],
  ['Inventory',     '/inventory',     Warehouse],
  ['Issue Log',     '/issues',        AlertTriangle],
  ['Master',        '/master-data',   Database],
  ['Settings',      '/settings',      Settings],
] as const

const sidebarVariants = {
  hidden: { x: -20, opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { x: -12, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-64 bg-white border-r border-border min-h-screen p-4 hidden md:flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2.5">
          <motion.span
            className="grid h-9 w-9 place-items-center rounded-lg bg-blue text-xs font-bold text-white shadow-sm"
            whileHover={{ scale: 1.08, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            SC
          </motion.span>
          <div>
            <span className="font-semibold text-text text-sm block">SCM Tower</span>
            <span className="text-[10px] text-muted">Control Center</span>
          </div>
        </div>
      </motion.div>

      {/* Nav Items */}
      <motion.nav
        className="space-y-0.5 flex-1"
        variants={sidebarVariants}
        initial="hidden"
        animate="visible"
      >
        {items.map(([label, href, Icon]) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <motion.div key={label} variants={itemVariants}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm relative overflow-hidden group
                  ${active
                    ? 'text-blue font-medium'
                    : 'text-gray-500 hover:text-text'
                  }
                `}
              >
                {/* Background fill animasi */}
                <AnimatePresence>
                  {active && (
                    <motion.div
                      key="active-bg"
                      className="absolute inset-0 bg-blue/8 rounded-lg"
                      layoutId="activeMenuBg"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    />
                  )}
                </AnimatePresence>

                {/* Hover background */}
                {!active && (
                  <motion.div
                    className="absolute inset-0 bg-gray-100 rounded-lg opacity-0 group-hover:opacity-100"
                    transition={{ duration: 0.15 }}
                  />
                )}

                {/* Active indicator bar kiri */}
                <AnimatePresence>
                  {active && (
                    <motion.div
                      key="indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 bg-blue rounded-r"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 24, opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon */}
                <motion.div
                  whileHover={{ scale: 1.15 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  className="relative z-10"
                >
                  <Icon
                    size={17}
                    className={`transition-colors duration-200 ${active ? 'text-blue' : 'text-gray-400 group-hover:text-gray-600'}`}
                  />
                </motion.div>

                <span className="flex-1 relative z-10">{label}</span>
              </Link>
            </motion.div>
          )
        })}
      </motion.nav>

      {/* Divider */}
      <div className="my-3 border-t border-border" />

      {/* Logout */}
      <motion.button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-red hover:bg-red/5 transition-colors w-full group"
        whileHover={{ x: 2 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <LogOut size={17} className="text-gray-400 group-hover:text-red transition-colors duration-200" />
        <span>Keluar</span>
      </motion.button>
    </aside>
  )
}
