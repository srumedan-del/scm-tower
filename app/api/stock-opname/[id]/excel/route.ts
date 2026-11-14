import { requireAuthenticatedUser } from '@/lib/requireUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { buildOpnameWorkbook, type OpnameDoc } from '@/lib/stock-opname-excel'

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  await requireAuthenticatedUser()
  const { id } = await context.params
  const doc: OpnameDoc = new URL(request.url).searchParams.get('doc') === 'lembar' ? 'lembar' : 'berita'

  const [{ data: session }, { data: lines }, { data: settings }] = await Promise.all([
    supabaseAdmin.from('stock_opname_session').select('*').eq('id', Number(id)).maybeSingle(),
    supabaseAdmin.from('stock_opname_line').select('*').eq('session_id', Number(id)).order('sort_order'),
    supabaseAdmin.from('stock_opname_settings').select('signers').eq('id', 1).maybeSingle(),
  ])
  if (!session) return Response.json({ error: 'Sesi opname tidak ditemukan' }, { status: 404 })

  const buffer = await buildOpnameWorkbook({
    doc,
    opnameDate: session.opname_date,
    period: session.period ?? 'Mingguan',
    pic: session.pic,
    lines: (lines ?? []).map(line => ({ ...line, qty_system: Number(line.qty_system), qty_physical: line.qty_physical == null ? null : Number(line.qty_physical) })),
    signers: (settings?.signers as { name: string; title: string }[] | undefined) ?? [],
  })
  const label = doc === 'lembar' ? `Form Stock Opname ${session.period ?? 'Mingguan'} BL ELISIO` : 'F-SRU-SCMWHL-37 Selisih Stock Opname SRU Medan'
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${label} ${session.opname_date}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
