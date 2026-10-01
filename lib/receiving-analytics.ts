export type ReceivingDetailForAnalytics = {
  item_no?: string | null
  description?: string | null
  quantity?: number | string | null
}

export type ReceivingPackaging = {
  sku_code?: string | null
  pcs_per_outer_box?: number | null
  outer_box_cbm?: number | null
  outer_box_weight_kg?: number | null
  pcs_per_pallet?: number | null
}

export function calculateReceivingLoad(details: ReceivingDetailForAnalytics[], packaging: ReceivingPackaging[]) {
  const packagingMap = new Map(packaging.map(item => [String(item.sku_code ?? '').trim().toUpperCase(), item]))
  let quantity = 0
  let volumeCbm = 0
  let weightKg = 0
  let pallets = 0
  let volumeRows = 0
  let weightRows = 0
  let palletRows = 0

  for (const detail of details) {
    const item = packagingMap.get(String(detail.item_no ?? '').trim().toUpperCase())
    const itemQuantity = Number(detail.quantity) || 0
    quantity += itemQuantity

    const pcsPerOuterBox = Number(item?.pcs_per_outer_box)
    const outerBoxes = pcsPerOuterBox > 0 ? Math.ceil(itemQuantity / pcsPerOuterBox) : 0
    if (outerBoxes && Number(item?.outer_box_cbm) > 0) {
      volumeCbm += outerBoxes * Number(item?.outer_box_cbm)
      volumeRows += 1
    }
    if (itemQuantity && Number(item?.outer_box_weight_kg) > 0 && pcsPerOuterBox > 0) {
      weightKg += Number(item?.outer_box_weight_kg) / pcsPerOuterBox * itemQuantity
      weightRows += 1
    }
    const pcsPerPallet = Number(item?.pcs_per_pallet)
    if (itemQuantity && pcsPerPallet > 0) {
      pallets += Math.ceil(itemQuantity / pcsPerPallet)
      palletRows += 1
    }
  }

  return {
    quantity,
    volumeCbm,
    weightKg,
    tonnage: weightKg / 1000,
    pallets,
    volumeRows,
    weightRows,
    palletRows,
  }
}