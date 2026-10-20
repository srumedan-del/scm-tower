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
        <div className="data-list-scroll overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">CUSTOMER CODE</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">CUSTOMER NAME</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">CITY</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">DK/LK</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">JENIS CUSTOMER</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">MESIN HD</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-text uppercase tracking-wide">ADDRESS</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">LOKASI</th>
                <th className="px-4 py-2.5 text-center text-xs font-medium text-text uppercase tracking-wide">ACTIVE</th>
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
