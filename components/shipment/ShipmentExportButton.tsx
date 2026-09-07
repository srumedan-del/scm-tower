'use client'

import { ExportExcelButton } from '@/components/ui/ExportExcelButton'
import { getShipmentExportData } from '@/app/(app)/shipment/export-actions'
import type { ExportSheetConfig } from '@/lib/exportExcel'

type Props = { status?: string }

export function ShipmentExportButton({ status }: Props) {
  async function getData(): Promise<ExportSheetConfig[]> {
    const rows = await getShipmentExportData(status)

    const sheet: ExportSheetConfig = {
      sheetName: 'Shipment Tracking',
      rows,
      columns: [
        { key: 'id',                      header: 'ID',                width: 8,  format: 'number' },
        { key: 'source_type',             header: 'Sumber',            width: 14 },
        { key: 'pss_no',                  header: 'PSS No.',           width: 20 },
        { key: 'trip_id',                 header: 'Trip ID',           width: 22 },
        { key: 'status',                  header: 'Status',            width: 14 },
        { key: 'customer_code',           header: 'Cust. Code',        width: 14 },
        { key: 'customer_name',           header: 'Customer',          width: 30 },
        { key: 'destination_city',        header: 'Kota Tujuan',       width: 16 },
        { key: 'dk_lk',                   header: 'DK/LK',             width: 8 },
        { key: 'document_date',           header: 'Doc Date',          width: 14, format: 'date' },
        { key: 'promised_delivery_date',  header: 'Promised Date',     width: 14, format: 'date' },
        { key: 'dispatch_time',           header: 'Dispatch Time',     width: 20 },
        { key: 'delivery_time',           header: 'Delivery Time',     width: 20 },
        { key: 'is_on_time',              header: 'On Time?',          width: 10 },
        { key: 'transporter_name',        header: 'Transporter',       width: 24 },
        { key: 'transporter_type',        header: 'Tipe',              width: 12 },
        { key: 'transporter_service_model',header:'Model Layanan',     width: 14 },
        { key: 'vehicle_no',              header: 'Kendaraan',         width: 14 },
        { key: 'driver_name',             header: 'Driver',            width: 20 },
        { key: 'helper_name',             header: 'Helper',            width: 20 },
        { key: 'route_code',              header: 'Rute',              width: 16 },
        { key: 'cost_model',              header: 'Model Biaya',       width: 14 },
        { key: 'payment_voucher_no',      header: 'No. Payment',       width: 22 },
        { key: 'bbm_liter',              header: 'BBM (Liter)',        width: 12, format: 'number' },
        { key: 'bbm_rupiah',             header: 'BBM (Rp)',           width: 14, format: 'currency' },
        { key: 'bongkar_muat_cost',      header: 'Bongkar Muat (Rp)', width: 16, format: 'currency' },
        { key: 'hotel_cost',             header: 'Hotel (Rp)',         width: 14, format: 'currency' },
        { key: 'uang_makan_driver',      header: 'Makan Driver (Rp)', width: 16, format: 'currency' },
        { key: 'uang_makan_helper',      header: 'Makan Helper (Rp)', width: 16, format: 'currency' },
        { key: 'toll_cost',              header: 'Tol (Rp)',           width: 14, format: 'currency' },
        { key: 'parkir_cost',            header: 'Parkir (Rp)',        width: 14, format: 'currency' },
        { key: 'kirim_paket_cost',       header: 'Kirim Paket (Rp)',  width: 16, format: 'currency' },
        { key: 'invoice_no_eksternal',   header: 'No. Invoice Eks.',  width: 22 },
        { key: 'total_biaya_eksternal',  header: 'Biaya Eks. (Rp)',   width: 16, format: 'currency' },
        { key: 'invoice_value',          header: 'Invoice Value (Rp)',width: 18, format: 'currency' },
        { key: 'total_biaya',            header: 'Total Biaya (Rp)',  width: 18, format: 'currency' },
        { key: 'cost_ratio',             header: 'Cost Ratio (%)',    width: 14, format: 'number' },
        { key: 'notes',                  header: 'Catatan',           width: 28 },
        { key: 'created_at',             header: 'Created At',        width: 20 },
      ],
    }

    return [sheet]
  }

  const statusLabel = status && status !== 'all' ? `_${status.replace(' ', '_')}` : ''

  return (
    <ExportExcelButton
      getData={getData}
      fileName={`shipment_tracking${statusLabel}`}
      label="Export Excel"
    />
  )
}
