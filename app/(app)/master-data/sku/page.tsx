import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { SkuRow } from '@/components/sku/SkuRow'
import SkuAddButton from '@/components/sku/SkuAddButton'

async function getSkus() {
  const { data } = await supabase.from('master_sku').select('*').order('sku_code')
  return data ?? []
}

export default async function SkuPage() {
  const skus = await getSkus()

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold mb-1">MASTER SKU</h1>
        <SkuAddButton />
      </header>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">SKU CODE</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ITEM NAME</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">CATEGORY</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">GROUP</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">UOM</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">SAFETY STOCK</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ACTIVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF0F4]">
              {skus.map((s:any) => (
                <SkuRow key={s.id} sku={s}/>
              ))}
              {skus.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Belum ada SKU.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}