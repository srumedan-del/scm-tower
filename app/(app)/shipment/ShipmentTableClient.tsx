'use client'

import { useState, useTransition } from 'react'
import { ShipmentTrackingRow, UntrackedPssRow } from './actions'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { EmptyState, SkeletonTable } from '@/components/ui/LoadingStates'
import { Button } from '@/components/ui/Button'
import ShipmentTMSPanel from '@/components/shipment/ShipmentTMSPanel'
import PodPanel from '@/components/shipment/PodPanel'
import { Plus, FileDown, Package, Truck } from 'lucide-react'

type Props = {
  untrackedData: UntrackedPssRow[]
  trackedData: ShipmentTrackingRow[]
  onRefresh: () => void
}

const STATUS_TABS = [
  { key: 'all', label: 'Semua' },
  { key: 'Draft', label: 'Draft' },
  { key: 'Dispatched', label: 'Dispatched' },
  { key: 'In Transit', label: 'In Transit' },
  { key: 'Delivered', label: 'Delivered' },
] as const

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Draft': 'bg-gray-100 text-gray-700',
    'Dispatched': 'bg-blue/10 text-blue',
    'In Transit': 'bg-orange/10 text-orange',
    'Delivered': 'bg-green/10 text-green',
  }
  return <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${map[status] ?? 'bg-gray-100'}`}>{status}</span>
}

function OtdBadge({ isOnTime }: { isOnTime: boolean | null }) {
  if (isOnTime === null) return <span className="text-xs text-muted">—</span>
  return (
    <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${isOnTime ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
      {isOnTime ? 'On Time' : 'Late'}
    </span>
  )
}

export function ShipmentTableClient({ untrackedData, trackedData, onRefresh }: Props) {
  const [mainTab, setMainTab] = useState<'untracked' | 'tracked'>('untracked')
  const [statusTab, setStatusTab] = useState<string>('all')
  const [selected, setSelected] = useState<ShipmentTrackingRow | null>(null)
  const [podShipment, setPodShipment] = useState<ShipmentTrackingRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [prefillPss, setPrefillPss] = useState<UntrackedPssRow | null>(null)
  const [loading, startLoading] = useTransition()

  const filteredTracked = statusTab === 'all'
    ? trackedData
    : trackedData.filter(r => r.status === statusTab)

  // Untracked columns
  const untrackedColumns: DataTableColumn<UntrackedPssRow>[] = [
    {
      key: 'pss_no',
      label: 'PSS No.',
      width: '140px',
      render: (val) => <span className="font-mono text-xs font-semibold text-blue">{val}</span>,
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (val) => <span className="text-sm">{val ?? '-'}</span>,
    },
    {
      key: 'destination_city',
      label: 'Destination',
      render: (val) => <span className="text-sm text-muted">{val ?? '-'}</span>,
    },
    {
      key: 'promised_delivery_date',
      label: 'Promised Delivery',
      width: '140px',
      render: (val) => <span className="text-xs text-muted">{val?.slice(0, 10) ?? '-'}</span>,
    },
  ]

  // Tracked columns
  const trackedColumns: DataTableColumn<ShipmentTrackingRow>[] = [
    {
      key: 'trip_id',
      label: 'Trip ID',
      width: '120px',
      render: (val) => <span className="font-mono text-xs font-bold text-blue">{val ?? '-'}</span>,
    },
    {
      key: 'pss_no',
      label: 'PSS No.',
      width: '120px',
      render: (val, row) => (
        <span className="font-mono text-xs text-gray-600">
          {val ?? (row.crossdocking_id ? `CD-${row.crossdocking_id}` : '-')}
        </span>
      ),
    },
    {
      key: 'customer_name',
      label: 'Customer',
      render: (val) => <span className="text-sm truncate">{val ?? '-'}</span>,
    },
    {
      key: 'destination_city',
      label: 'Destination',
      render: (val) => <span className="text-sm text-muted">{val ?? '-'}</span>,
    },
    {
      key: 'transporter_name',
      label: 'Transporter',
      render: (val) => <span className="text-sm">{val ?? '-'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: 'is_on_time',
      label: 'OTD',
      render: (val) => <OtdBadge isOnTime={val} />,
    },
  ]

  return (
    <>
      {selected && (
        <ShipmentTMSPanel
          shipment={selected}
          prefillPss={prefillPss}
          onClose={() => {
            setSelected(null)
            setPrefillPss(null)
          }}
          onSaved={() => {
            onRefresh()
            setSelected(null)
          }}
        />
      )}

      {podShipment && (
        <PodPanel
          shipment={podShipment}
          onClose={() => setPodShipment(null)}
          onSaved={() => {
            onRefresh()
            setPodShipment(null)
          }}
        />
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-border">
        <div className="flex gap-1">
          {(['untracked', 'tracked'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                mainTab === tab
                  ? 'border-blue text-blue'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {tab === 'untracked' ? 'Untracked PSS' : 'Shipment Tracking'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<FileDown size={14} />}>
            Export
          </Button>
          <Button
            size="sm"
            icon={<Plus size={14} />}
            onClick={() => {
              setAdding(true)
              setMainTab('tracked')
            }}
          >
            Add
          </Button>
        </div>
      </div>

      {mainTab === 'untracked' ? (
        <div className="space-y-4">
          {loading ? (
            <SkeletonTable rows={5} cols={4} />
          ) : untrackedData.length === 0 ? (
            <EmptyState
              icon="box"
              title="Semua PSS sudah ditracks"
              description="Tidak ada PSS yang belum masuk ke shipment tracking"
              action={{ label: 'Refresh', onClick: onRefresh }}
            />
          ) : (
            <DataTable
              data={untrackedData}
              columns={untrackedColumns}
              rowKey="pss_no"
              onRowClick={row => {
                setPrefillPss(row)
                setSelected({
                  source_type: 'PSS',
                  status: 'Draft',
                  pss_no: row.pss_no,
                  outbound_header_id: row.id,
                  customer_name: row.customer_name,
                  destination_city: row.destination_city,
                  promised_delivery_date: row.promised_delivery_date,
                  document_date: row.document_date,
                } as ShipmentTrackingRow)
              }}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Status tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusTab(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  statusTab === tab.key
                    ? 'bg-blue text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading ? (
            <SkeletonTable rows={5} cols={7} />
          ) : filteredTracked.length === 0 ? (
            <EmptyState
              icon="truck"
              title="Tidak ada shipment"
              description={`Tidak ada shipment dengan status ${statusTab}`}
            />
          ) : (
            <DataTable
              data={filteredTracked}
              columns={trackedColumns}
              rowKey="id"
              onRowClick={row => setSelected(row)}
              expandable={{
                render: row => (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-muted font-bold">Dispatch</span>
                      <p className="text-sm mt-1">{row.dispatch_time?.slice(0, 10) ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted font-bold">Delivery</span>
                      <p className="text-sm mt-1">{row.delivery_time?.slice(0, 10) ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted font-bold">Cost Model</span>
                      <p className="text-sm mt-1">{row.cost_model ?? '-'}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setSelected(row)}>
                        Edit
                      </Button>
                      {row.status === 'Delivered' && (
                        <Button size="sm" variant="secondary" onClick={() => setPodShipment(row)}>
                          POD
                        </Button>
                      )}
                    </div>
                  </div>
                ),
              }}
            />
          )}
        </div>
      )}
    </>
  )
}
