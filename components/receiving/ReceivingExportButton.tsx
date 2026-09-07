'use client'

import { ExportExcelButton } from '@/components/ui/ExportExcelButton'
import { getReceivingExportData, getReceivingDetailExportData } from '@/app/(app)/receiving/export-actions'
import type { ExportSheetConfig } from '@/lib/exportExcel'

type Props = { months?: string[] }

export function ReceivingExportButton({ months }: Props) {
  async function getData(): Promise<ExportSheetConfig[]> {
    const [headers, details] = await Promise.all([
      getReceivingExportData(months),
      getReceivingDetailExportData(),
    ])

    const headerSheet: ExportSheetConfig = {
      sheetName: 'PTR Header',
      rows: headers,
      columns: [
        { key: 'ptr_no',                 header: 'PTR No.',             width: 20 },
        { key: 'transfer_order_no',      header: 'Transfer Order No.',  width: 20 },
        { key: 'transfer_from_code',     header: 'From',                width: 14 },
        { key: 'transfer_to_code',       header: 'To',                  width: 14 },
        { key: 'posting_date',           header: 'Posting Date',        width: 14, format: 'date' },
        { key: 'shipment_date',          header: 'Shipment Date',       width: 14, format: 'date' },
        { key: 'receipt_date',           header: 'Receipt Date',        width: 14, format: 'date' },
        { key: 'shipping_agent_code',    header: 'Shipping Agent',      width: 16 },
        { key: 'ship_to_receipt_days',   header: 'Ship→Receipt (hari)', width: 18, format: 'number' },
        { key: 'receipt_to_posting_days',header: 'Receipt→Post (hari)', width: 18, format: 'number' },
        { key: 'ship_to_posting_days',   header: 'Ship→Post (hari)',    width: 16, format: 'number' },
        { key: 'import_period',          header: 'Periode Import',      width: 14 },
      ],
    }

    const detailSheet: ExportSheetConfig = {
      sheetName: 'PTR Detail (ILE)',
      rows: details,
      columns: [
        { key: 'document_no',    header: 'PTR No.',       width: 20 },
        { key: 'posting_date',   header: 'Posting Date',  width: 14, format: 'date' },
        { key: 'item_no',        header: 'Item No.',      width: 16 },
        { key: 'description',    header: 'Deskripsi',     width: 36 },
        { key: 'quantity',       header: 'Qty',           width: 10, format: 'number' },
        { key: 'uom',            header: 'UOM',           width: 8 },
        { key: 'lot_no',         header: 'LOT No.',       width: 16 },
        { key: 'expiration_date',header: 'Expired',       width: 14, format: 'date' },
        { key: 'location_code',  header: 'Location',      width: 14 },
      ],
    }

    return [headerSheet, detailSheet]
  }

  const periodLabel = months && months.length > 0
    ? `_${months.sort()[0]}_${months.sort().slice(-1)[0]}`
    : ''

  return (
    <ExportExcelButton
      getData={getData}
      fileName={`receiving${periodLabel}`}
      label="Export Excel"
    />
  )
}
