import Link from 'next/link'
import { Activity } from 'lucide-react'
import { CustomerStockMapClient } from '@/components/customer-stock-map/CustomerStockMapClient'
import { requireAuthenticatedUser } from '@/lib/requireUser'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

async function getHdSummary() {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('machine_count, latitude, longitude')
    .eq('is_active', true)
    .eq('is_hd_customer', true)
  if (error) throw error

  const customers = data ?? []
  const located = customers.filter(row => row.latitude != null && row.longitude != null).length
  return {
    customerCount: customers.length,
    machineCount: customers.reduce((sum, row) => sum + (Number(row.machine_count) || 0), 0),
    located,
    coverage: customers.length ? Math.round((located * 100) / customers.length) : 0,
  }
}

export default async function PetaStokHdPage() {
  await requireAuthenticatedUser()
  const { customerCount, machineCount, located, coverage } = await getHdSummary()

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">PETA &amp; STOK HD</h1>
          <p className="mt-1 text-sm text-slate-500">
            {customerCount} customer aktif · {machineCount.toLocaleString('id-ID')} mesin HD ·{' '}
            {located}/{customerCount} lokasi ({coverage}%)
          </p>
        </div>
        <Link
          href="/inventory/hd-monitoring"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <Activity className="h-4 w-4" /> HD Monitoring
        </Link>
      </header>

      <CustomerStockMapClient showMaintainBelow />
    </div>
  )
}
