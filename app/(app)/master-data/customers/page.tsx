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
        <div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 border-b border-[#E5E7EB] bg-[#F8FAFC]">
              <tr>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">CUSTOMER CODE</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">CUSTOMER NAME</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">CITY</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">DK/LK</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">JENIS CUSTOMER</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">MESIN HD</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ADDRESS</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">LOKASI</th>
                <th className="px-4 py-2.5 text-xs font-bold uppercase tracking-[0.1em] text-[#64748B] whitespace-nowrap">ACTIVE</th>
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
