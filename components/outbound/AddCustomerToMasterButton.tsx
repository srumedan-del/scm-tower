'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import CustomerEditPanel from '@/components/customer/CustomerEditPanel'

/**
 * Untuk PSS yang kode customernya belum ada di master Customer (MTA tidak bisa dihitung).
 * Membuka form customer baru dengan kode dan nama dari PSS sudah terisi.
 */
export function AddCustomerToMasterButton({ customerCode, customerName }: { customerCode: string; customerName: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Kode customer ini belum ada di master Customer, jadi MTA tidak bisa dihitung. Klik untuk menambahkan."
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
      >
        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
        Tambah ke master
      </button>
      {open && (
        <CustomerEditPanel
          customer={null}
          initial={{ customer_code: customerCode, customer_name: (customerName ?? '').toUpperCase() }}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
