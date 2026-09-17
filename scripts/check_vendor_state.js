const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
;(async () => {
  const shipment = await s.from('shipment_tracking').select('id,pss_no,transporter_id,cost_model,notes').eq('pss_no', 'PSS-2609-1508').single()
  const view = await s.from('vw_shipment_tms').select('pss_no,transporter_id,transporter_name,cost_model,notes').eq('pss_no', 'PSS-2609-1508').single()
  const vendors = await s.from('vendors').select('id,vendor_name,vendor_type').in('id', [5, 9])
  const transporters = await s.from('master_transporter').select('id,transporter_code,name,type,service_model').order('id')
  console.log(JSON.stringify({ shipment: shipment.data, view: view.data, vendors: vendors.data, transporters: transporters.data, errors: { shipment: shipment.error && shipment.error.message, view: view.error && view.error.message, vendors: vendors.error && vendors.error.message, transporters: transporters.error && transporters.error.message } }, null, 2))
})().catch(error => { console.error(error.message); process.exit(1) })
