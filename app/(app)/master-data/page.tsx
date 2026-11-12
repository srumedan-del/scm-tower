import Link from 'next/link'
import {
  Building2, ChevronRight, Hospital, Package, Receipt, Route, Truck, UserRound, Users, Warehouse, type LucideIcon,
} from 'lucide-react'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { countAppUsers } from './users/actions'

type CountKey = 'users' | 'vendors' | 'customers' | 'rates' | 'fleet' | 'drivers' | 'routes' | 'warehouses' | 'skus' | 'transporters'

const TABLES: Record<Exclude<CountKey, 'users'>, string> = {
  vendors: 'vendors',
  customers: 'customers',
  rates: 'transport_rate_card',
  fleet: 'transport_fleet',
  drivers: 'master_driver',
  routes: 'routes',
  warehouses: 'warehouses',
  skus: 'master_sku',
  transporters: 'master_transporter',
}

async function getCounts() {
  const entries = await Promise.all(
    (Object.entries(TABLES) as [Exclude<CountKey, 'users'>, string][]).map(async ([key, table]) => {
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true })
      return [key, count ?? 0] as const
    }),
  )
  return { ...Object.fromEntries(entries), users: await countAppUsers() } as Record<CountKey, number>
}

const groups: { title: string; items: { name: string; path: string; desc: string; icon: LucideIcon; count: CountKey }[] }[] = [
  {
    title: 'Mitra dan pelanggan',
    items: [
      { name: 'Vendor', path: '/vendor', desc: 'Vendor transport, PIC, SLA, all-in TKBM, multidrop', icon: Building2, count: 'vendors' },
      { name: 'Customer', path: '/master-data/customers', desc: 'Klinik dan rumah sakit, DK/LK, kota, alamat', icon: Hospital, count: 'customers' },
      { name: 'Rate Card', path: '/master-data/rate-card', desc: 'Tarif transport per vendor, tujuan, dan jenis unit', icon: Receipt, count: 'rates' },
    ],
  },
  {
    title: 'Armada dan rute',
    items: [
      { name: 'Armada', path: '/master-data/vehicles', desc: 'Kendaraan internal, nopol, jenis, kapasitas', icon: Truck, count: 'fleet' },
      { name: 'Driver', path: '/master-data/drivers', desc: 'Driver dan helper internal SRU', icon: UserRound, count: 'drivers' },
      { name: 'Rute', path: '/master-data/routes', desc: 'Rute pengiriman dan lead time', icon: Route, count: 'routes' },
      { name: 'Transporter', path: '/master-data/transporters', desc: 'Transporter untuk assignment shipment', icon: Truck, count: 'transporters' },
    ],
  },
  {
    title: 'Gudang dan barang',
    items: [
      { name: 'Gudang', path: '/master-data/warehouses', desc: 'Daftar gudang aktif', icon: Warehouse, count: 'warehouses' },
      { name: 'SKU', path: '/master-data/sku', desc: 'Master SKU dan safety stock', icon: Package, count: 'skus' },
    ],
  },
  {
    title: 'Sistem',
    items: [
      { name: 'Pengguna', path: '/master-data/users', desc: 'Akun login web: tambah, reset password, nonaktifkan', icon: Users, count: 'users' },
    ],
  },
]

export default async function MasterDataPage() {
  const counts = await getCounts()

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-3xl font-bold mb-1">Master Data</h1>
      </header>

      {groups.map(group => (
        <section key={group.title} aria-labelledby={`md-${group.title}`} className="space-y-3">
          <h2 id={`md-${group.title}`} className="text-xs font-semibold uppercase tracking-[0.08em] text-gold-700">{group.title}</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {group.items.map(item => {
              const Icon = item.icon
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-gold-300"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-indigo-900">{item.name}</span>
                      <span className="font-mono text-lg font-bold text-slate-900">{counts[item.count].toLocaleString('id-ID')}</span>
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-slate-500">{item.desc}</span>
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gold-600" aria-hidden="true" />
                </Link>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
