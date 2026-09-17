const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const sourcePath = process.argv[2] || 'data/PSSD1109.XLS.xlsx'
const apply = process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const text = (value) => String(value == null ? '' : value).trim()
const upper = (value) => text(value).toUpperCase()
const isPss = (value) => upper(value).startsWith('PSS')
const isPao = (value) => upper(value).startsWith('PAO')

function sourceDateTime(value) {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    if (!date) return null
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}T${String(date.H || 0).padStart(2, '0')}:${String(date.M || 0).padStart(2, '0')}:${String(Math.floor(date.S || 0)).padStart(2, '0')}+07:00`
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  const raw = text(value)
  if (!raw) return null
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) return raw
  return `${raw}+07:00`
}

function minuteKey(value) {
  const raw = sourceDateTime(value)
  if (!raw) return null
  const time = new Date(raw)
  if (Number.isNaN(time.getTime())) return null
  return Math.floor(time.getTime() / 60000)
}

function context(row) {
  return [row.PROJECT, row['CABANG/PERWAKILAN'], row['Location Code']].map(upper).join('\u001f')
}

function contextMatches(detail, header) {
  const required = ['PROJECT', 'Location Code']
  const optional = ['CABANG/PERWAKILAN']
  const fieldMatches = (field, requiredField) => {
    const left = upper(detail[field])
    const right = upper(header[field])
    if (!left || !right) return !requiredField
    return left === right
  }
  return required.every((field) => fieldMatches(field, true))
    && optional.every((field) => fieldMatches(field, false))
}

function mapRow(row, documentNo) {
  const now = new Date().toISOString()
  const posting = row['Posting Date'] instanceof Date
    ? row['Posting Date'].toISOString().slice(0, 10)
    : text(row['Posting Date']).slice(0, 10)
  const expiration = row['Expiration Date'] instanceof Date
    ? row['Expiration Date'].toISOString().slice(0, 10)
    : text(row['Expiration Date']).slice(0, 10)
  const record = {
    posting_date: posting || null,
    document_created_at: sourceDateTime(row['Document Created Date/Time']),
    entry_type: row['Entry Type'] || null,
    document_no: documentNo,
    item_no: row['Item No.'] || null,
    description: row.Description || null,
    branch_representative: row['CABANG/PERWAKILAN'] || null,
    project: row.PROJECT || null,
    location_code: row['Location Code'] || null,
    lot_no: row['Lot No.'] || null,
    expiration_date: expiration && expiration !== 'null' ? expiration : null,
    quantity: Number.isFinite(Number(row.Quantity)) ? Number(row.Quantity) : null,
    qty_out: Number.isFinite(Number(row['Invoiced Quantity'])) ? Number(row['Invoiced Quantity']) : null,
    entry_no: Number.isFinite(Number(row['Entry No.'])) ? Number(row['Entry No.']) : null,
    source_file: sourcePath,
    import_period: now.slice(0, 7),
    created_at: now,
    updated_at: now,
  }
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null && value !== undefined && value !== ''))
}

async function getAllHeaders() {
  const result = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('outbound_header')
      .select('id,pss_no,shipment_no,document_created_at,document_date,project,branch_representative,location_code')
      .range(from, from + 999)
    if (error) throw error
    result.push(...(data || []))
    if (!data || data.length < 1000) return result
  }
}

async function main() {
  const workbook = XLSX.readFile(sourcePath)
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: null })
  const headers = await getAllHeaders()
  const candidates = new Map()

  for (const row of rows) {
    const documentNo = text(row['Document No.'])
    if (!isPss(documentNo)) continue
    const key = `${context(row)}\u001f${minuteKey(row['Document Created Date/Time'])}`
    const list = candidates.get(key) || []
    list.push({ documentNo, row })
    candidates.set(key, list)
  }

  for (const header of headers) {
    const documentNo = text(header.pss_no || header.shipment_no)
    if (!isPss(documentNo)) continue
    for (const row of rows) {
      if (!isPao(row['Document No.']) || !contextMatches(row, {
        PROJECT: header.project,
        'CABANG/PERWAKILAN': header.branch_representative,
        'Location Code': header.location_code,
      })) continue
      const key = `${context(row)}\u001f${minuteKey(header.document_created_at || header.document_date)}`
      const list = candidates.get(key) || []
      if (!list.some((candidate) => candidate.documentNo === documentNo)) list.push({ documentNo, row: null })
      candidates.set(key, list)
    }
  }

  const normalized = []
  const unmapped = []
  for (const row of rows) {
    const original = text(row['Document No.'])
    let documentNo = original
    if (isPao(original)) {
      const key = `${context(row)}\u001f${minuteKey(row['Document Created Date/Time'])}`
      const match = (candidates.get(key) || [])[0]
      if (match) documentNo = match.documentNo
      else unmapped.push(original)
    }
    normalized.push(mapRow(row, documentNo))
  }

  const entryNos = normalized.map((row) => row.entry_no).filter(Number.isFinite)
  const existing = new Map()
  for (let from = 0; from < entryNos.length; from += 500) {
    const { data, error } = await supabase.from('outbound_detail').select('entry_no,document_no').in('entry_no', entryNos.slice(from, from + 500))
    if (error) throw error
    for (const row of data || []) existing.set(Number(row.entry_no), row)
  }

  const missing = normalized.filter((row) => Number.isFinite(row.entry_no) && !existing.has(Number(row.entry_no)))
  const updates = normalized.filter((row) => {
    const current = existing.get(Number(row.entry_no))
    return current && text(current.document_no) !== text(row.document_no)
  })
  const target = normalized.filter((row) => row.document_no === 'PSS-2609-0800')
  console.log(JSON.stringify({ sourceRows: rows.length, existingEntries: existing.size, missingRows: missing.length, remapRows: updates.length, unmappedPaos: [...new Set(unmapped)], targetRows: target.map((row) => ({ entry_no: row.entry_no, document_no: row.document_no, item_no: row.item_no })) }, null, 2))

  if (!apply || (!missing.length && !updates.length)) return

  const changedRows = [...missing, ...updates]
  const pssNos = [...new Set(changedRows.map((row) => row.document_no).filter(isPss))]
  const { data: pssHeaders, error: headerError } = await supabase
    .from('outbound_header')
    .select('id,pss_no,shipment_no')
    .in('pss_no', pssNos)
  if (headerError) throw headerError
  const headerMap = new Map()
  for (const header of pssHeaders || []) {
    if (header.pss_no) headerMap.set(text(header.pss_no), header.id)
    if (header.shipment_no) headerMap.set(text(header.shipment_no), header.id)
  }
  const insertable = missing.map((row) => ({ ...row, outbound_header_id: headerMap.get(row.document_no) || null }))
  const missingHeaders = [...new Set(changedRows.filter((row) => !headerMap.has(row.document_no)).map((row) => row.document_no))]
  if (missingHeaders.length) throw new Error(`Missing outbound headers: ${missingHeaders.join(', ')}`)

  for (const row of updates) {
    const { error } = await supabase
      .from('outbound_detail')
      .update({ document_no: row.document_no, outbound_header_id: headerMap.get(row.document_no) })
      .eq('entry_no', row.entry_no)
    if (error) throw error
  }

  for (let from = 0; from < insertable.length; from += 500) {
    const { error } = await supabase.from('outbound_detail').insert(insertable.slice(from, from + 500))
    if (error) throw error
  }
  console.log(`Inserted ${insertable.length} missing outbound detail rows.`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
