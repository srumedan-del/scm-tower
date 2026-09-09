'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getShipmentTrackings, getUntrackedPss,
  type ShipmentTrackingRow, type UntrackedPssRow,
} from './actions'
import ShipmentTMSPanel from '@/components/shipment/ShipmentTMSPanel'
import BulkShipmentPanel from '@/components/shipment/BulkShipmentPanel'
import PodPanel from '@/components/shipment/PodPanel'
import { ShipmentTableClient } from './ShipmentTableClient'

export default function ShipmentPage() {
  const [untracked, setUntracked] = useState<UntrackedPssRow[]>([])
  const [tracked, setTracked] = useState<ShipmentTrackingRow[]>([])
  const [loading, startLoading] = useTransition()

  // Panels
  const [selected, setSelected] = useState<ShipmentTrackingRow | null>(null)
  const [podShipment, setPodShipment] = useState<ShipmentTrackingRow | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [checkedUt, setCheckedUt] = useState<Set<string>>(new Set())

  function loadData() {
    startLoading(async () => {
      try {
        const [ut, tr] = await Promise.all([
          getUntrackedPss(),
          getShipmentTrackings(),
        ])
        setUntracked(ut)
        setTracked(tr)
      } catch (e) {
        console.error('Failed to load shipment data:', e)
      }
    })
  }

  useEffect(() => {
    loadData()
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl font-bold text-text">Shipment Tracking</h1>
        <p className="text-sm text-muted mt-1">TMS — PSS & Crossdocking · Data dari 01 Sep 2026</p>
      </header>

      {/* Table Client */}
      <ShipmentTableClient
        untrackedData={untracked}
        trackedData={tracked}
        onRefresh={loadData}
      />

      {/* Panels */}
      {selected && (
        <ShipmentTMSPanel
          shipment={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null)
            loadData()
          }}
        />
      )}

      {podShipment && (
        <PodPanel
          shipment={podShipment}
          onClose={() => setPodShipment(null)}
          onSaved={() => {
            setPodShipment(null)
            loadData()
          }}
        />
      )}

      {bulkOpen && checkedUt.size > 0 && (
        <BulkShipmentPanel
          selectedPss={untracked.filter(r => checkedUt.has(r.pss_no))}
          onClose={() => setBulkOpen(false)}
          onSaved={() => {
            setBulkOpen(false)
            setCheckedUt(new Set())
            loadData()
          }}
        />
      )}
    </div>
  )
}
