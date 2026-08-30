import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { VendorRow } from '@/components/vendor/VendorRow'
import VendorAddButton from '@/components/vendor/VendorAddButton'

type Vendor = {
  id: number
  vendor_code: string
  vendor_name: string
  vendor_type: string | null
  pic_name: string | null
  phone: string | null
  email: string | null
  coverage_area: string | null
  default_sla: number | null
  is_active: boolean | null
  created_at: string | null
}

async function getVendors() {
  const { data, error } = await supabase
    .from('vendors')
    .select('id, vendor_code, vendor_name, vendor_type, pic_name, phone, email, coverage_area, default_sla, is_active, created_at')
    .order('vendor_name')
    .limit(200)
  if (error) console.error('vendors fetch error:', error.message)
  return (data ?? []) as Vendor[]
}

export default async function VendorPage() {
  const vendors = await getVendors()

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold mb-1">VENDOR MANAGEMENT</h1>
        <VendorAddButton />
      </header>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">KODE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">NAMA</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">TIPE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PIC</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">PHONE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">COVERAGE</th>
                <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SLA</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ACTIVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors.map((v) => (
                <VendorRow key={v.id} vendor={v} />
              ))}
              {vendors.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Belum ada vendor.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}