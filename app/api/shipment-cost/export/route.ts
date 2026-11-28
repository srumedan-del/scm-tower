import { requireAuthenticatedUser } from '@/lib/requireUser'
import { getShipmentCosts } from '@/app/(app)/shipment-cost/actions'
import { matchesCostSearch } from '@/app/(app)/shipment-cost/utils'
import { buildShipmentCostWorkbook, periodLabel } from '@/lib/shipment-cost-excel'

/** Rekap realisasi biaya kirim bulanan (.xlsx); dibuat di server agar browser tidak memuat exceljs. */
export async function GET(request: Request) {
  await requireAuthenticatedUser()
  const params = new URL(request.url).searchParams
  const month = params.get('month') || 'all'
  const search = params.get('q') ?? ''

  const rows = (await getShipmentCosts({ status: 'Delivered', month })).filter((r) => matchesCostSearch(r, search))
  const buffer = await buildShipmentCostWorkbook(rows, month)
  const filename = `Realisasi Biaya Kirim SCM Medan DK & LK - ${periodLabel(month)}.xlsx`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  })
}
