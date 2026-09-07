'use server'

import { supabaseAdmin } from '@/lib/supabaseAdmin'

export type InventorySnapshotRow = {
  id: number
  snapshot_date: string
  warehouse_code: string
  sku_code: string
  qty_on_hand: number
  qty_reserved: number
  qty_available: number | null    // GENERATED
  avg_daily_usage: number | null
  days_of_supply: number | null   // GENERATED
  alert_status: string | null     // GENERATED: OK | LOW | CRITICAL | STOCKOUT
  notes: string | null
  source: string | null
  import_period: string | null
  created_at: string | null
  updated_at: string | null
  // joined
  item_name?: string | null
  category?: string | null
  safety_stock?: number | null
  uom?: string | null
}

export type WarehouseOption  = { warehouse_code: string; warehouse_name: string }
export type SkuOption        = { sku_code: string; item_name: string; safety_stock: number | null; uom: string }

// ─── Options ──────────────────────────────────────────────────────────────────

export async function getSnapshotOptions(): Promise<{
  warehouses: WarehouseOption[]
  skus: SkuOption[]
}> {
  const [{ data: wh }, { data: sk }] = await Promise.all([
    supabaseAdmin.from('warehouses').select('warehouse_code, warehouse_name').eq('is_active', true).order('warehouse_code'),
    supabaseAdmin.from('master_sku').select('sku_code, item_name, safety_stock, uom').eq('is_active', true).order('sku_code'),
  ])
  return {
    warehouses: (wh ?? []) as WarehouseOption[],
    skus:       (sk ?? []) as SkuOption[],
  }
}

// ─── Snapshot list (current = snapshot terbaru per SKU per gudang) ─────────────

export async function getCurrentInventory(warehouseCode?: string): Promise<InventorySnapshotRow[]> {
  // Ambil snapshot terbaru per SKU per gudang via view
  const { data, error } = await supabaseAdmin
    .from('vw_inventory_current')
    .select('*')
    .order('alert_status')        // STOCKOUT → CRITICAL → LOW → OK
    .order('sku_code')
    .limit(500)

  if (error) {
    // Fallback jika view belum ada: ambil langsung dari table
    const q = supabaseAdmin
      .from('inventory_snapshot')
      .select(`
        *,
        master_sku!inner(item_name, category, safety_stock, uom)
      `)
      .order('snapshot_date', { ascending: false })
      .limit(500)
    const { data: fallback } = await q
    return (fallback ?? []).map((r: any) => ({
      ...r,
      item_name:    r.master_sku?.item_name ?? null,
      category:     r.master_sku?.category ?? null,
      safety_stock: r.master_sku?.safety_stock ?? null,
      uom:          r.master_sku?.uom ?? null,
    })) as InventorySnapshotRow[]
  }

  return (data ?? []) as InventorySnapshotRow[]
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export async function upsertSnapshot(
  row: Omit<InventorySnapshotRow, 'id' | 'qty_available' | 'days_of_supply' | 'alert_status' | 'created_at' | 'updated_at' | 'item_name' | 'category' | 'safety_stock' | 'uom'> & { id?: number }
) {
  const { id, ...payload } = row

  if (id) {
    const { error } = await supabaseAdmin.from('inventory_snapshot').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { error } = await supabaseAdmin.from('inventory_snapshot').insert(payload)
    if (error) throw error
  }
}

export async function deleteSnapshot(id: number) {
  const { error } = await supabaseAdmin.from('inventory_snapshot').delete().eq('id', id)
  if (error) throw error
}

// Bulk upsert dari upload (ON CONFLICT snapshot_date, warehouse_code, sku_code → update)
export async function bulkUpsertSnapshots(
  rows: Omit<InventorySnapshotRow, 'id' | 'qty_available' | 'days_of_supply' | 'alert_status' | 'created_at' | 'updated_at' | 'item_name' | 'category' | 'safety_stock' | 'uom'>[]
) {
  const { error } = await supabaseAdmin
    .from('inventory_snapshot')
    .upsert(rows, { onConflict: 'snapshot_date,warehouse_code,sku_code', ignoreDuplicates: false })
  if (error) throw error
  return rows.length
}
