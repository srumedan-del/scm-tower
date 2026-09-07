'use client'
import { useState } from 'react'
import IssueEditPanel from './IssueEditPanel'

export default function IssueAddButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
      >
        + TAMBAH ISSUE
      </button>
      {open && (
        <IssueEditPanel
          issue={null}
          onClose={() => setOpen(false)}
          onSaved={() => { if (typeof window !== 'undefined') window.location.reload() }}
        />
      )}
    </>
  )
}
