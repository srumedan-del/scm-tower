const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const wanted = [
  'PSS-2608-2747', 'PSS-2604-2090', 'PSS-2603-0279', 'PSS-2602-3069',
  'PSS-2602-3068', 'PSS-2601-2171', 'PSS-2601-2098', 'PSS-2601-2089',
]
const text = (value) => String(value == null ? '' : value).trim()
const workbook = XLSX.readFile('data/pssdetall.xlsx', { cellDates: true })
const source = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  const { data: headers, error } = await supabase
    .from('outbound_header')
    .select('id,pss_no,document_date,document_created_at,project,branch_representative,location_code')
    .in('pss_no', wanted)
  if (error) throw error

  const result = {}
  for (const number of wanted) result[number] = { sourcePssRows: [], candidatePaos: [] }
  const headerList = headers || []

  for (const row of source) {
    const document = text(row['Document No.'])
    if (wanted.includes(document)) {
      result[document].sourcePssRows.push({
        entry_no: row['Entry No.'], item_no: row['Item No.'], quantity: row.Quantity,
        created_at: row['Document Created Date/Time'], entry_type: row['Entry Type'],
      })
    }
  }

  const pssByProject = new Map()
  for (const header of headerList) {
    const key = `${text(header.project)}\u001f${text(header.location_code)}`
    const list = pssByProject.get(key) || []
    list.push(header)
    pssByProject.set(key, list)
  }

  for (const row of source) {
    const document = text(row['Document No.'])
    if (!document.toUpperCase().startsWith('PAO-')) continue
    const key = `${text(row.PROJECT)}\u001f${text(row['Location Code'])}`
    for (const header of pssByProject.get(key) || []) {
      result[header.pss_no].candidatePaos.push({
        pao: document, entry_no: row['Entry No.'], item_no: row['Item No.'],
        created_at: row['Document Created Date/Time'], posting_date: row['Posting Date'],
        project: row.PROJECT, header_project: header.project,
        header_date: header.document_date, header_time: header.document_created_at,
      })
    }
  }

  for (const number of wanted) {
    result[number].candidatePaos = result[number].candidatePaos.filter((row, index, all) => all.findIndex((item) => item.pao === row.pao) === index)
  }
  console.log(JSON.stringify({ headers: headerList, result }, null, 2))
}

main().catch((error) => { console.error(error.message || error); process.exit(1) })
