const { createClient } = require('@supabase/supabase-js')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
;(async () => {
  const q = await s.from('shipment_tracking').select('id,notes').eq('pss_no', 'PSS-2609-1508').single()
  if (q.error) throw q.error
  const notes = String(q.data.notes || '').replace(/^Vendor:\s*INDAH LOGISTIK\s*/i, 'Vendor: INDAH LOGISTIK RETAIL ')
  const u = await s.from('shipment_tracking').update({ notes }).eq('id', q.data.id).select('id,notes')
  if (u.error) throw u.error
  console.log(JSON.stringify(u.data, null, 2))
})().catch(error => { console.error(error.message); process.exit(1) })
