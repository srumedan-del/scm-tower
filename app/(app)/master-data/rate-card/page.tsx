import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import RateCardList from '@/components/rate-card/RateCardList'

async function getRates() {
  // Use underlying table transport_rate_card directly so we have id for edit/delete
  // Join via view would lose id; try table first, fallback to view
  const { data, error } = await supabase.from('transport_rate_card').select('*').order('rate_code')
  if (!error && data) {
    const vendorIds = [...new Set(data.map((rate: any) => rate.vendor_id).filter(Boolean))]
    const vendorById = new Map<number, { vendor_code: string; vendor_name: string }>()

    if (vendorIds.length) {
      const { data: vendors } = await supabase
        .from('vendors')
        .select('id, vendor_code, vendor_name')
        .in('id', vendorIds)

      for (const vendor of vendors ?? []) {
        vendorById.set(vendor.id, vendor)
      }
    }

    return data.map((rate: any) => ({
      ...rate,
      vendor_code: vendorById.get(rate.vendor_id)?.vendor_code ?? null,
      vendor_name: vendorById.get(rate.vendor_id)?.vendor_name ?? null,
    }))
  }
  const { data: v } = await supabase.from('v_transport_rate_card').select('*').order('rate_code')
  return (v ?? []) as any[]
}

export default async function RateCardPage() {
  const rates = await getRates() as any[]
  return (
    <div className="rate-card-page h-full min-h-0">
      <RateCardList rates={rates} />
    </div>
  )
}