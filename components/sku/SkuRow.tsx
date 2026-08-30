'use client'

import { useState } from 'react'
import SkuEditPanel from './EditPanel'

type Sku = {
  id: number
  sku_code: string
  item_name: string
  category: string | null
  group: string | null
  uom: string
  safety_stock: number | null
  is_active: boolean
}

export function SkuRow({ sku }: { sku: Sku }) {
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <tr
        className="hover:bg-blue-50 cursor-pointer transition-colors"
        onClick={() => setEditOpen(true)}
      >
        <td className="px-4 py-2.5 font-mono text-xs font-medium">{sku.sku_code}</td>
        <td className="px-4 py-2.5 font-medium">{sku.item_name}</td>
        <td className="px-4 py-2.5">
          {sku.category ? (
            <span className="inline-block text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">{sku.category}</span>
          ) : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-4 py-2.5">
          {sku.group ? (
            <span className={`inline-block text-xs px-2 py-0.5 rounded font-medium uppercase ${
              sku.group === 'HD' ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'
            }`}>{sku.group}</span>
          ) : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-4 py-2.5 text-gray-700">{sku.uom}</td>
        <td className="px-4 py-2.5 text-right text-gray-700">
          {sku.safety_stock != null ? sku.safety_stock.toLocaleString('id-ID') : <span className="text-gray-400">—</span>}
        </td>
        <td className="px-4 py-2.5 text-center">
          {sku.is_active ? (
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"/>
          ) : (
            <span className="inline-block w-2 h-2 bg-gray-300 rounded-full"/>
          )}
        </td>
      </tr>
      {editOpen && (
        <SkuEditPanel
          sku={sku}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            if (typeof window !== 'undefined') window.location.reload()
          }}
        />
      )}
    </>
  )
}