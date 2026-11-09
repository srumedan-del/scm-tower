'use client'
import { DialogShell, DialogHeader, dialogBodyClass, dialogFooterClass, dialogCancelClass, dialogPrimaryClass, dialogDangerClass, FormField as Field } from '@/components/ui/FormDialog'
import { Truck } from 'lucide-react'
import { useState, useTransition, useEffect } from 'react'
import { supabase as supabaseRaw } from '@/lib/supabase'
import SearchableSelect from '@/components/ui/SearchableSelect'
import { confirmAction, showSuccess } from '@/lib/feedback'
const supabase: any = supabaseRaw

type FleetType = 'Internal' | 'Eksternal'

type Shipment = {
  id: string
  shipment_no: string | null
  document_no: string | null
  shipment_date: string | null
  origin_warehouse: string | null
  destination_site: string | null
  destination_name: string | null
  destination_city: string | null
  route: string | null
  shipment_type: string | null
  vendor_name: string | null
  vehicle_no: string | null
  driver_name: string | null
  status: string | null
  eta: string | null
  sla_status: string | null
  pod_status: string | null
  delay_reason: string | null
  notes: string | null
  fleet_type: string | null
}

type Log = { id:number; status_from:string|null; status_to:string|null; updated_at:string|null; location:string|null; notes:string|null }

const STATUS_OPTS = ['Draft','Dispatched','In Transit','Arrived','Completed','Delayed','Cancelled'] as const
const SLA_OPTS = ['On Time','Late','Pending'] as const
const POD_OPTS = ['Pending','Missing'] as const

const empty: Omit<Shipment,'id'> = {
  shipment_no:'', document_no:'', shipment_date:'', origin_warehouse:'SRU MEDAN',
  destination_site:null, destination_name:'', destination_city:'', route:'', shipment_type:'trucking',
  vendor_name:'', vehicle_no:'', driver_name:'', status:'Draft', eta:'', sla_status:'Pending', pod_status:'Pending', delay_reason:'', notes:'', fleet_type: null,
}

export default function ShipmentEditPanel({ shipment, onClose, onSaved, vendors, fleetType }:{ shipment: Shipment|null; onClose:()=>void; onSaved:()=>void; vendors:{vendor_name:string;vendor_code:string}[]; fleetType?: FleetType }) {
  const [form,setForm]=useState<Omit<Shipment,'id'>>(()=>{
    if(shipment) return {
      shipment_no: shipment.shipment_no ?? '',
      document_no: shipment.document_no ?? '',
      shipment_date: shipment.shipment_date ? shipment.shipment_date.slice(0,10) : '',
      origin_warehouse: shipment.origin_warehouse ?? 'SRU MEDAN',
      destination_site: shipment.destination_site ?? null,
      destination_name: shipment.destination_name ?? '',
      destination_city: shipment.destination_city ?? '',
      route: shipment.route ?? '',
      shipment_type: shipment.shipment_type ?? 'trucking',
      vendor_name: shipment.vendor_name ?? '',
      vehicle_no: shipment.vehicle_no ?? '',
      driver_name: shipment.driver_name ?? '',
      status: shipment.status ?? 'Draft',
      eta: shipment.eta ? shipment.eta.slice(0,10) : '',
      sla_status: shipment.sla_status ?? 'Pending',
      pod_status: shipment.pod_status ?? 'Pending',
      delay_reason: shipment.delay_reason ?? '',
      notes: shipment.notes ?? '',
      fleet_type: shipment.fleet_type ?? null,
    }
    return { ...empty, shipment_date: new Date().toISOString().slice(0,10), fleet_type: fleetType ?? null }
  })
  const [saving,startSaving]=useTransition()
  const [deleting,startDeleting]=useTransition()
  const [err,setErr]=useState<string|null>(null)
  const [logs,setLogs]=useState<Log[]>([])
  const [logsLoading,setLogsLoading]=useState(false)
  const up=(k:keyof typeof form,v:any)=>setForm(f=>({...f,[k]:v}))

  // Determine cost_model based on fleet_type
  const cost_model: 'Internal' | 'Trucking' | null = form.fleet_type === 'Internal' ? 'Internal' : form.fleet_type === 'Eksternal' ? 'Trucking' : null

  useEffect(()=>{
    if(!shipment?.id) return
    setLogsLoading(true)
    supabase.from('shipment_status_logs').select('id,status_from,status_to,updated_at,location,notes').eq('shipment_id', shipment.id).order('updated_at', {ascending:false}).limit(20).then((res:any)=>{
      if(!res.error) setLogs(res.data||[])
      setLogsLoading(false)
    })
  },[shipment?.id])

  async function del(){
    if(!shipment) return
    if (!(await confirmAction({ title: 'Hapus shipment?', message: `Shipment ${shipment.shipment_no} akan dihapus.` }))) return
    startDeleting(async()=>{
      const {error}=await supabase.from('shipments').delete().eq('id',shipment.id)
      if(error){setErr(error.message);return}
      onClose(); void showSuccess({ title: 'Shipment dihapus' }).then(onSaved)
    })
  }
  function save(){
    startSaving(async()=>{
      setErr(null)
      if(!String(form.shipment_no ?? '').trim()||!form.shipment_date||!String(form.destination_city ?? '').trim()){setErr('SHIPMENT NO, TANGGAL & DESTINATION CITY WAJIB DIISI');return}
      if(!form.fleet_type){setErr('PILIH JENIS ARMADA (Internal/Eksternal)');return}
      const payload:any={
        shipment_no: String(form.shipment_no ?? '').trim().toUpperCase(),
        document_no: (form.document_no??'').trim().toUpperCase()||null,
        shipment_date: form.shipment_date || null,
        origin_warehouse: (form.origin_warehouse??'').trim().toUpperCase()||null,
        destination_city: String(form.destination_city ?? '').trim().toUpperCase()||null,
        destination_name: (form.destination_name??'').trim().toUpperCase()||null,
        route: (form.route??'').trim().toUpperCase()||null,
        shipment_type: (form.shipment_type??'').trim().toLowerCase()||null,
        vendor_name: (form.vendor_name??'').trim().toUpperCase()||null,
        vehicle_no: (form.vehicle_no??'').trim().toUpperCase()||null,
        driver_name: (form.driver_name??'').trim().toUpperCase()||null,
        status: form.status || 'Draft',
        eta: form.eta || null,
        sla_status: form.sla_status || null,
        pod_status: form.pod_status || null,
        delay_reason: (form.delay_reason??'').trim().toUpperCase()||null,
        notes: (form.notes??'').trim().toUpperCase()||null,
        fleet_type: form.fleet_type,
        cost_model: cost_model,
      }
      let error
      const prevStatus = shipment?.status ?? null
      if(shipment){
        const r=await supabase.from('shipments').update(payload).eq('id',shipment.id)
        error=r.error
        if(!error && prevStatus && prevStatus !== payload.status){
          await supabase.from('shipment_status_logs').insert({ shipment_id: shipment.id, status_from: prevStatus, status_to: payload.status, notes: 'STATUS UPDATE VIA UI' })
        }
      } else {
        const r=await supabase.from('shipments').insert(payload).select('id').single()
        error=r.error
        if(!error && r.data?.id){
          await supabase.from('shipment_status_logs').insert({ shipment_id: r.data.id, status_from: null, status_to: payload.status, notes: 'CREATED VIA UI' })
        }
      }
      if(error){setErr(error.message);return}
      onClose(); void showSuccess({ title: 'Shipment tersimpan' }).then(onSaved)
    })
  }

  return (
    <DialogShell onClose={onClose} size="3xl">
      <DialogHeader title={shipment ? 'Edit Shipment' : 'Tambah Shipment'} subtitle={shipment ? undefined : 'Catat pengiriman baru'} icon={Truck} />
        <div className={dialogBodyClass}>
          {/* ── Fleet Type Selector (first step) ── */}
          <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
            <label className="block text-xs font-bold text-gray-700 mb-2">JENIS ARMADA *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="Internal"
                  checked={form.fleet_type === 'Internal'}
                  onChange={() => up('fleet_type', 'Internal')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Internal (Kendaraan milik SRU)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="Eksternal"
                  checked={form.fleet_type === 'Eksternal'}
                  onChange={() => up('fleet_type', 'Eksternal')}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm">Eksternal (Sewa / Vendor)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Shipment no *"><input value={String(form.shipment_no ?? '')} onChange={e=>up('shipment_no',e.target.value)} className="inp font-mono" placeholder="SHP-2026-08-31-001" disabled={!!shipment} /></Field>
            <Field label="Document no (PSS)"><input value={form.document_no ?? ''} onChange={e=>up('document_no',e.target.value)} className="inp font-mono" placeholder="PSS-..." /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal kirim *"><input type="date" value={form.shipment_date ?? ''} onChange={e=>up('shipment_date',e.target.value)} className="inp" /></Field>
            <Field label="ETA"><input type="date" value={form.eta ?? ''} onChange={e=>up('eta',e.target.value)} className="inp" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origin"><input value={form.origin_warehouse ?? ''} onChange={e=>up('origin_warehouse',e.target.value)} className="inp" placeholder="SRU MEDAN" /></Field>
            <Field label="Destination city *"><input value={String(form.destination_city ?? '')} onChange={e=>up('destination_city',e.target.value)} className="inp" placeholder="BANDA ACEH" /></Field>
          </div>
          <Field label="Destination name"><input value={form.destination_name ?? ''} onChange={e=>up('destination_name',e.target.value)} className="inp" placeholder="NAMA CUSTOMER/SITE" /></Field>

          {/* ── Vendor (only for Eksternal) ── */}
          {form.fleet_type === 'Eksternal' && (
            <Field label="Vendor *">
              <SearchableSelect value={form.vendor_name ?? ''} onChange={value => up('vendor_name', value)} placeholder="-- PILIH VENDOR --" options={vendors.map(v => ({ value: v.vendor_name, label: `${v.vendor_code} — ${v.vendor_name}` }))} />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Shipment type">
              <select value={form.shipment_type ?? 'trucking'} onChange={e=>up('shipment_type',e.target.value)} className="inp">
                <option value="trucking">TRUCKING</option><option value="courier">COURIER</option><option value="expedition">EXPEDITION</option><option value="retail_delivery">RETAIL DELIVERY</option>
              </select>
            </Field>
            {/* ── Vehicle No (Internal: from master armada; Eksternal: manual input) ── */}
            <Field label="Vehicle no">
              {form.fleet_type === 'Internal' ? (
                <input value={form.vehicle_no ?? ''} onChange={e=>up('vehicle_no',e.target.value)} className="inp font-mono" placeholder="BK 1234 XX" />
              ) : (
                <input value={form.vehicle_no ?? ''} onChange={e=>up('vehicle_no',e.target.value)} className="inp font-mono" placeholder="Nopol kendaraan vendor" />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Driver">
              {form.fleet_type === 'Internal' ? (
                <input value={form.driver_name ?? ''} onChange={e=>up('driver_name',e.target.value)} className="inp" placeholder="Driver internal SRU" />
              ) : (
                <input value={form.driver_name ?? ''} onChange={e=>up('driver_name',e.target.value)} className="inp" placeholder="Nama driver vendor" />
              )}
            </Field>
            <Field label="HELPER (Opsional)">
              <input value={form.notes ?? ''} onChange={e=>up('notes',e.target.value)} className="inp" placeholder="Nama helper" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <select value={form.status ?? 'Draft'} onChange={e=>up('status',e.target.value)} className="inp">
                {STATUS_OPTS.map(s=> <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label="SLA">
              <select value={form.sla_status ?? 'Pending'} onChange={e=>up('sla_status',e.target.value||null)} className="inp">
                {SLA_OPTS.map(s=> <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </Field>
            <Field label="POD">
              <select value={form.pod_status ?? 'Pending'} onChange={e=>up('pod_status',e.target.value||null)} className="inp">
                {POD_OPTS.map(s=> <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Delay reason"><input value={form.delay_reason ?? ''} onChange={e=>up('delay_reason',e.target.value)} className="inp" /></Field>
          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

          {shipment && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="text-xs font-bold text-gray-700 mb-2">RIWAYAT STATUS — SHIPMENT_STATUS_LOGS</div>
              {logsLoading ? <div className="text-xs text-gray-500">MEMUAT...</div> : logs.length===0 ? <div className="text-xs text-gray-500">BELUM ADA LOG</div> : (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {logs.map(l=>(
                    <div key={l.id} className="flex items-center gap-2 text-xs bg-white border rounded px-2 py-1.5">
                      <span className="font-mono text-gray-500">{l.updated_at ? new Date(l.updated_at).toLocaleString('id-ID') : '-'}</span>
                      <span className="font-bold">{(l.status_from||'—').toUpperCase()}</span>
                      <span>→</span>
                      <span className="font-bold text-blue-700">{(l.status_to||'—').toUpperCase()}</span>
                      {l.notes && <span className="text-gray-600 truncate ml-1">· {l.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-gray-500 mt-1.5">SETIAP GANTI STATUS OTOMATIS TERCATAT KE LOG</div>
            </div>
          )}
        </div>
        <div className={dialogFooterClass}>
          <div>{shipment && <button onClick={del} disabled={deleting} className={dialogDangerClass}>{deleting?'Menghapus…':'Hapus'}</button>}</div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={dialogCancelClass}>Batal</button>
            <button onClick={save} disabled={saving} className={dialogPrimaryClass}>{saving?'Menyimpan…':'Simpan'}</button>
          </div>
        </div>
    </DialogShell>
  )
}
