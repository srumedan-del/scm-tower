'use client'

import { ExportExcelButton } from '@/components/ui/ExportExcelButton'
import { getOutboundExportData, getOutboundDetailExportData } from '@/app/(app)/outbound/export-actions'
import type { ExportSheetConfig } from '@/lib/exportExcel'

type Props = { months?: string[] }

export function OutboundExportButton({ months }: Props) {
  async function getData(): Promise<ExportSheetConfig[]> {
    const [headers, details] = await Promise.all([
      getOutboundExportData(months),
      getOutboundDetailExportData(months),
    ])

    const headerSheet: ExportSheetConfig = {
      sheetName: 'PSS Header',
      rows: headers,
      columns: [
        { key: 'pss_no',                header: 'PSS No.',              width: 20 },
        { key: 'psi_no',                header: 'PSI No.',              width: 20 },
        { key: 'document_date',         header: 'Document Date',        width: 14, format: 'date' },
        { key: 'order_no',              header: 'Order No.',            width: 20 },
        { key: 'customer_no',           header: 'Customer No.',         width: 14 },
        { key: 'customer_name',         header: 'Customer Name',        width: 32 },
        { key: 'ship_to_city',          header: 'City',                 width: 16 },
        { key: 'promised_delivery_date',header: 'Promised Date',        width: 14, format: 'date' },
        { key: 'cust_receipt_date',     header: 'Receipt Date',         width: 14, format: 'date' },
        { key: 'delivery_delay_days',   header: 'Delay (hari)',         width: 12, format: 'number' },
        { key: 'is_late',               header: 'Terlambat?',           width: 12 },
        { key: 'location_code',         header: 'Location Code',        width: 14 },
        { key: 'shipping_agent_code',   header: 'Shipping Agent',       width: 16 },
        { key: 'package_tracking_no',   header: 'Tracking No.',         width: 20 },
        { key: 'import_period',         header: 'Periode Import',       width: 14 },
      ],
    }

    const detailSheet: ExportSheetConfig = {
      sheetName: 'Outbound Detail (ILE)',
      rows: details,
      columns: [
        { key: 'entry_no',       header: 'Entry No.',     width: 12, format: 'number' },
        { key: 'document_no',    header: 'PSS No.',       width: 20 },
        { key: 'posting_date',   header: 'Posting Date',  width: 14, format: 'date' },
        { key: 'item_no',        header: 'Item No.',      width: 16 },
        { key: 'description',    header: 'Deskripsi',     width: 36 },
        { key: 'quantity',       header: 'Qty',           width: 10, format: 'number' },
        { key: 'qty_out',        header: 'Qty Out',       width: 10, format: 'number' },
        { key: 'lot_no',         header: 'LOT No.',       width: 16 },
        { key: 'expiration_date',header: 'Expired',       width: 14, format: 'date' },
        { key: 'location_code',  header: 'Location',      width: 14 },
        { key: 'entry_type',     header: 'Entry Type',    width: 12 },
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
      fileName={`outbound${periodLabel}`}
      label="Export Excel"
    />
  )
}
