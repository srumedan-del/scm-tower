'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Props = {
  row: {
    id: number | string
    outbound_header_id?: number | string | null
    document_no?: string | null
  }
}

export default function OutboundDeleteButton({ row }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    const target = row.outbound_header_id != null ? `header ${row.outbound_header_id}` : `detail ${row.id}`

    if (!confirm(`Hapus data outbound ${target}?\n\nCatatan: jika header dihapus, detail yang terkait akan ikut terhapus otomatis melalui cascade.`)) {
      return
    }

    startTransition(async () => {
      try {
        let error = null

        if (row.outbound_header_id != null) {
          const result = await supabase.from('outbound_header').delete().eq('id', Number(row.outbound_header_id))
          error = result.error
        } else {
          const result = await supabase.from('outbound_detail').delete().eq('id', Number(row.id))
          error = result.error
        }

        if (error) {
          alert(`Gagal hapus data: ${error.message}`)
          return
        }

        router.refresh()
      } catch (e: any) {
        alert(`Gagal hapus data: ${e?.message ?? 'Unknown error'}`)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
    >
      {pending ? 'MENGHAPUS...' : 'DELETE'}
    </button>
  )
}
