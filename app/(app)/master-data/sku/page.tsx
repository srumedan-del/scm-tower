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
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SKU CODE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ITEM NAME</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CATEGORY</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">GROUP</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">UOM</th>
                <th className="text-right px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">SAFETY STOCK</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ACTIVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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