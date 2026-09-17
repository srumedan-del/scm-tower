const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const workbookArgument = process.argv.slice(2).find(argument => !argument.startsWith('--'));
const workbookPath = workbookArgument || path.join('data', '61 2026-09-04 KLINIK AYAH BUNDA.xlsx');
const shouldApply = process.argv.includes('--apply');

function readEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of fs.readFileSync(path.join(__dirname, '..', file), 'utf8').split(/\r?\n/)) {
        if (!line || line.startsWith('#') || !line.includes('=')) continue;
        const index = line.indexOf('=');
        env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
      }
    } catch {}
  }
  return env;
}

function normalizeHeader(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim().replace(/\s/g, '');
  if (!text || /^[-–—]+$/.test(text)) return null;
  let normalized = text;
  if (text.includes(',') && !text.includes('.')) {
    const commaParts = text.split(',');
    normalized = commaParts.length === 2 && commaParts[1].length === 3
      ? text.replace(',', '')
      : text.replace(',', '.')
  } else {
    normalized = text.replace(/,/g, '')
  }
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function value(row, headers, aliases) {
  for (const alias of aliases) {
    const index = headers.findIndex(header => header === normalizeHeader(alias));
    if (index >= 0 && row[index] !== null && row[index] !== undefined && String(row[index]).trim() !== '') return row[index];
  }
  return null;
}

function mapRow(row, headers) {
  const skuCode = String(value(row, headers, ['no item']) ?? '').trim().toUpperCase();
  if (!skuCode) return null;
  return {
    sku_code: skuCode,
    item_name: String(value(row, headers, ['item description']) ?? '').trim().toUpperCase() || null,
    uom: 'PCS',
    inner_length_cm: parseNumber(value(row, headers, ['p cm inner'])),
    inner_width_cm: parseNumber(value(row, headers, ['l cm inner'])),
    inner_height_cm: parseNumber(value(row, headers, ['t cm inner'])),
    outer_length_cm: parseNumber(value(row, headers, ['p cm outer'])),
    outer_width_cm: parseNumber(value(row, headers, ['l cm outer'])),
    outer_height_cm: parseNumber(value(row, headers, ['t cm outer'])),
    outer_box_cbm: parseNumber(value(row, headers, ['kubik outer box'])),
    pcs_per_inner_box: parseNumber(value(row, headers, ['pcs 1 inner box'])),
    inner_boxes_per_outer_box: parseNumber(value(row, headers, ['inner box 1 outer box'])),
    pcs_per_outer_box: parseNumber(value(row, headers, ['pcs 1 outer box'])),
    outer_boxes_per_layer: parseNumber(value(row, headers, ['outer box 1 layer'])),
    stack_count: parseNumber(value(row, headers, ['jumlah tumpukan'])),
    outer_boxes_per_pallet: parseNumber(value(row, headers, ['outer box 1 pallet'])),
    pcs_per_pallet: parseNumber(value(row, headers, ['pcs 1 pallet'])),
    outer_box_weight_kg: parseNumber(row[17] ?? value(row, headers, ['berat kg', 'berat (kg)'])),
    packaging_status: String(value(row, headers, ['aktif non aktif']) ?? '').trim() || null,
    group: String(value(row, headers, ['hd nhd']) ?? '').trim().toUpperCase() || null,
    volume_source: path.basename(workbookPath),
    volume_updated_at: new Date().toISOString(),
  };
}

async function main() {
  if (!fs.existsSync(workbookPath)) throw new Error(`Workbook tidak ditemukan: ${workbookPath}`);
  const workbook = XLSX.readFile(workbookPath, { cellFormula: true });
  const sheet = workbook.Sheets['MASTER VOLUME'];
  if (!sheet) throw new Error('Sheet MASTER VOLUME tidak ditemukan.');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  const headers = rows[1].map(normalizeHeader);
  const imported = rows.slice(2).map(row => mapRow(row, headers)).filter(Boolean);
  const unique = [...new Map(imported.map(row => [row.sku_code, row])).values()];
  const env = readEnv();
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL || '', env.SUPABASE_SERVICE_ROLE_KEY || '');
  const { data: existing, error } = await client.from('master_sku').select('sku_code').limit(5000);
  if (error) throw error;
  const existingCodes = new Set((existing ?? []).map(row => String(row.sku_code).trim().toUpperCase()));
  const matched = unique.filter(row => existingCodes.has(row.sku_code));
  const missing = unique.filter(row => !existingCodes.has(row.sku_code));
  console.log(JSON.stringify({ workbook: workbookPath, rows: unique.length, matched: matched.length, missing: missing.length, missingExamples: missing.slice(0, 20).map(row => row.sku_code), mode: shouldApply ? 'apply' : 'dry-run' }, null, 2));

  if (!shouldApply) return;
  const existingRows = unique
    .filter(row => existingCodes.has(row.sku_code))
    .map(row => {
      if (row.item_name) return row;
      const { item_name: _itemName, ...withoutItemName } = row;
      return withoutItemName;
    });
  const newRows = unique.filter(row => !existingCodes.has(row.sku_code) && row.item_name);
  const skippedInvalid = unique.filter(row => !existingCodes.has(row.sku_code) && !row.item_name);
  for (const row of existingRows) {
    const { sku_code, ...payload } = row;
    const { error: updateError } = await client.from('master_sku').update(payload).eq('sku_code', sku_code);
    if (updateError) throw updateError;
  }
  for (let index = 0; index < newRows.length; index += 100) {
    const batch = newRows.slice(index, index + 100);
    const { error: insertError } = await client.from('master_sku').insert(batch);
    if (insertError) throw insertError;
  }
  console.log(`Imported ${existingRows.length + newRows.length} SKU packaging rows; skipped ${skippedInvalid.length} rows without item_name.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });