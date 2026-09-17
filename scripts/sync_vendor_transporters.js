const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

;(async () => {
  const vendors = await s.from('vendors').select('id,vendor_name,vendor_type,is_active').order('id')
  if (vendors.error) throw vendors.error
  const rows = (vendors.data || []).map(v => {
    const type = String(v.vendor_type || '').toUpperCase().includes('INTERNAL') ? 'Internal' : 'Eksternal'
    const serviceModel = String(v.vendor_type || '').toUpperCase().includes('RETAIL') ? 'Retail' : type === 'Internal' ? null : 'Trucking'
    return {
      transporter_code: `VENDOR-${v.id}`,
      name: v.vendor_name,
      type,
      service_model: serviceModel,
      is_active: v.is_active !== false,
      notes: `Synced from vendors.id=${v.id}`,
    }
  })
  const result = await s.from('master_transporter').upsert(rows, { onConflict: 'transporter_code' }).select('id,transporter_code,name,type,service_model')
  if (result.error) throw result.error
  const indah = (result.data || []).find(row => /INDAH LOGISTIK RETAIL/i.test(row.name))
  if (indah) {
    const update = await s.from('shipment_tracking').update({ transporter_id: indah.id }).eq('pss_no', 'PSS-2609-1508')
    if (update.error) throw update.error
  }
  console.log(JSON.stringify({ synced: result.data, targetTransporter: indah || null }, null, 2))
})().catch(error => { console.error(error.message || error); process.exit(1) })
