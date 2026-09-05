import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

async function getCounts() {
  const [v, r, w, s, sh, c, dr, tr] = await Promise.all([
    supabase.from('vendors').select('*', { count: 'exact', head: true }),
    supabase.from('routes').select('*', { count: 'exact', head: true }),
    supabase.from('warehouses').select('*', { count: 'exact', head: true }),
    supabase.from('master_sku').select('*', { count: 'exact', head: true }),
    supabase.from('shipments').select('*', { count: 'exact', head: true }),
    supabase.from('customers').select('*', { count: 'exact', head: true }),
    supabase.from('master_driver').select('*', { count: 'exact', head: true }),
    supabase.from('master_transporter').select('*', { count: 'exact', head: true }),
  ])
  return {
    vendors: v.count ?? 0, routes: r.count ?? 0, warehouses: w.count ?? 0,
    skus: s.count ?? 0, shipments: sh.count ?? 0, customers: c.count ?? 0,
    drivers: dr.count ?? 0, transporters: tr.count ?? 0,
  }
}

const items = [
  { name: 'Vendors',        path: '/vendor',                      desc: 'Master vendor transport dengan PIC, SLA, coverage', icon: '🏢' },
  { name: 'Customers',      path: '/master-data/customers',        desc: 'Klinik & RS — DK/LK, kota, alamat', icon: '🏥' },
  { name: 'Rate Card',      path: '/master-data/rate-card',        desc: 'Tarif transport per vendor & rute', icon: '💰' },
  { name: 'Armada',         path: '/master-data/vehicles',         desc: 'Armada internal — nopol, jenis, kapasitas', icon: '🚛' },
  { name: 'Driver',         path: '/master-data/drivers',          desc: 'Driver internal SRU — SIM, no. HP', icon: '👤' },
  { name: 'Transporter',    path: '/master-data/transporters',     desc: '1 Internal + 3 Eksternal (Retail/Trucking)', icon: '🚚' },
  { name: 'Routes',         path: '/master-data/routes',           desc: 'Master rute pengiriman + lead time', icon: '🛣️' },
  { name: 'Warehouses',     path: '/master-data/warehouses',       desc: 'Daftar gudang aktif', icon: '🏭' },
  { name: 'SKU',            path: '/master-data/sku',              desc: 'Master SKU + safety stock', icon: '📦' },
]

export default async function MasterDataPage() {
  const counts = await getCounts()

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold mb-1">Master Data</h1>
        <p className="text-muted">Pusat data referensi SCM: vendor, rute, gudang, SKU, driver, dan transporter.</p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map(item => (
          <a key={item.path} href={item.path} className="bg-white border border-border rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-2">{item.icon}</div>
            <div className="font-semibold text-lg">{item.name}</div>
            <div className="text-sm text-gray-600 mt-1">{item.desc}</div>
          </a>
        ))}
      </section>

      <section className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-3">Statistik Master Data</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 text-sm">
          <Mini label="Vendors"      value={counts.vendors}/>
          <Mini label="Customers"    value={counts.customers}/>
          <Mini label="Routes"       value={counts.routes}/>
          <Mini label="Warehouses"   value={counts.warehouses}/>
          <Mini label="SKUs"         value={counts.skus}/>
          <Mini label="Driver"       value={counts.drivers}/>
          <Mini label="Transporter"  value={counts.transporters}/>
          <Mini label="Shipments"    value={counts.shipments}/>
        </div>
      </section>
    </div>
  )
}

function Mini({label, value}:{label:string;value:number}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  )
}