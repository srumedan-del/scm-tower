import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs'

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd3pwb2ZneGdhdXlzc2F0Z2FjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMxNjM0MywiZXhwIjoyMTAyODkyMzQzfQ.0fEGVyDXRFsJVF94iKEen4Vcy4HlHbyKaULlwoI7Kz8'
const s = createClient('https://elwzpofgxgauyssatgac.supabase.co', token)

console.log('Testing insert with service_role...')
const r = await s.from('outbound_detail').insert([{
  entry_no: 888888,
  posting_date: '2026-09-03',
  document_no: 'PSS-2609-0494',
  item_no: 'TEST',
  quantity: -1,
  source_file: 'test',
  import_period: '2026-09',
  outbound_header_id: 5802
}]).select()

console.log('data :', JSON.stringify(r.data))
console.log('error:', JSON.stringify(r.error))

if (r.data?.[0]?.id) {
  await s.from('outbound_detail').delete().eq('id', r.data[0].id)
  console.log('cleaned up')
}
