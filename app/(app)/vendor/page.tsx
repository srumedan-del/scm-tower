import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { VendorRow } from '@/components/vendor/VendorRow'
import VendorAddButton from '@/components/vendor/VendorAddButton'

type Vendor = {
  id: number
  vendor_code: string
  vendor_name: string
  vendor_type: string | null
  vendor_category: 'Internal' | 'Eksternal' | null
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
    .select('id, vendor_code, vendor_name, vendor_type, vendor_category, pic_name, phone, email, coverage_area, default_sla, is_active, created_at')
    .order('vendor_category')
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
        <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">KODE</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">NAMA</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">KATEGORI</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">TIPE</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">PIC</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">PHONE</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">COVERAGE</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">SLA</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ACTIVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendors.map((v) => (
                <VendorRow key={v.id} vendor={v} />
              ))}
              {vendors.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Belum ada vendor.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}