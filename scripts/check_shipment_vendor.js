const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
;(async () => {
  const shipment = await s.from('shipment_tracking').select('id,pss_no,transporter_id,cost_model,notes').eq('pss_no', 'PSS-2609-1508').single()
  const vendors = await s.from('vendors').select('id,vendor_name,vendor_type,is_active').order('id')
  console.log(JSON.stringify({ shipment: shipment.data, vendors: vendors.data, errors: [shipment.error && shipment.error.message, vendors.error && vendors.error.message] }, null, 2))
})().catch(error => { console.error(error.message); process.exit(1) })
