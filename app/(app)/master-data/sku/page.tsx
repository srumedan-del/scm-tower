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
        <div className="data-list-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">SKU CODE</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">ITEM NAME</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">CATEGORY</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">GROUP</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">UOM</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-text uppercase tracking-wide">SAFETY STOCK</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">ACTIVE</th>
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