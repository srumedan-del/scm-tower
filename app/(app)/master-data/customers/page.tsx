import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { CustomerRow } from '@/components/customer/CustomerRow'
import CustomerAddButton from '@/components/customer/CustomerAddButton'

async function getCustomers() {
  const { data } = await supabase.from('customers').select('*').order('customer_code').limit(200)
  return data ?? []
}

export default async function CustomersPage() {
  const customers = await getCustomers() as any[]

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold mb-1">MASTER CUSTOMERS</h1>
        <CustomerAddButton />
      </header>

      <section className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CUSTOMER CODE</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CUSTOMER NAME</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">CITY</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">DK/LK</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">HD</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">MESIN HD</th>
                <th className="text-left px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ADDRESS</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">LOKASI</th>
                <th className="text-center px-4 py-3 uppercase tracking-wide text-xs font-bold text-gray-900">ACTIVE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c:any) => (
                <CustomerRow key={c.id} customer={c}/>
              ))}
              {customers.length===0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">Belum ada customer.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}