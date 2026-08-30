'use client'

import { useEffect, useMemo, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Check, Map as MapIcon, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import 'leaflet/dist/leaflet.css'

type Customer = {
	id: string
	name: string
	city: string
	province: string
	latitude: number
	longitude: number
	machine_count: number
	stock_quantity: number
	daily_usage: number
	last_order_date: string | null
	lead_time_days: number
	safety_buffer_days: number
}

type FormState = Omit<Customer, 'id'>

const MAX_CUSTOMERS = 27

const emptyForm: FormState = {
	name: '', city: '', province: 'Sumatera Utara', latitude: 3.5952, longitude: 98.6722,
	machine_count: 0, stock_quantity: 0, daily_usage: 0, last_order_date: '', lead_time_days: 3, safety_buffer_days: 2,
}

const provinceBounds: Record<string, [[number, number], [number, number]]> = {
	'All': [[1.2, 94.5], [4.8, 100.8]],
	'Aceh': [[2.0, 94.5], [6.1, 98.2]],
	'Sumatera Utara': [[0.8, 97.0], [4.5, 100.8]],
}

function statusFor(customer: Customer) {
	const coverage = customer.daily_usage > 0 ? customer.stock_quantity / customer.daily_usage : Infinity
	const trigger = customer.lead_time_days + customer.safety_buffer_days
	if (coverage <= customer.lead_time_days) return { label: 'Critical', color: '#E56458', coverage }
	if (coverage <= trigger) return { label: 'Replenish now', color: '#D5803B', coverage }
	return { label: 'Healthy', color: '#46A171', coverage }
}

function createHospitalIcon(color: string) {
	return L.divIcon({
		className: 'hospital-marker-wrap',
		html: `<span class="hospital-marker" style="--marker-color:${color}"><span>+</span></span>`,
		iconSize: [30, 30],
		iconAnchor: [15, 15],
	})
}

function FitBounds({ province }: { province: string }) {
	const map = useMap()
	useEffect(() => { map.fitBounds(provinceBounds[province] ?? provinceBounds.All, { padding: [12, 12] }) }, [map, province])
	return null
}

function formatDate(value: string | null) {
	if (!value) return 'Belum ada data'
	return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value))
}

export function CustomerStockMap({ publicOnly = false }: { publicOnly?: boolean }) {
	const [customers, setCustomers] = useState<Customer[]>([])
	const [mode, setMode] = useState<'map' | 'maintain'>('map')
	const [province, setProvince] = useState('All')
	const [editing, setEditing] = useState<Customer | null>(null)
	const [formOpen, setFormOpen] = useState(false)
	const [form, setForm] = useState<FormState>(emptyForm)
	const [coordinateText, setCoordinateText] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [message, setMessage] = useState('')
	const [maintenanceOpen, setMaintenanceOpen] = useState(false)

	useEffect(() => {
		let active = true
		const handleShortcut = (event: KeyboardEvent) => {
			if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'm') {
				event.preventDefault()
				setMaintenanceOpen((open) => !open)
				setMode('maintain')
			}
		}
		window.addEventListener('keydown', handleShortcut)
		const load = async () => {
			const { data, error } = await (supabase as any).from('customers').select('*').order('name')
			if (active) {
				if (error) setMessage(`Supabase belum mengembalikan data: ${error.message}`)
				const validCustomers = ((data ?? []) as Customer[]).filter((customer) => typeof customer?.name === 'string' && customer.name.trim().length > 0)
				const uniqueCustomers = [...new Map(validCustomers.map((customer) => [customer.name.trim().toUpperCase(), customer])).values()]
				setCustomers(uniqueCustomers.slice(0, MAX_CUSTOMERS))
				setLoading(false)
			}
		}
		load()
		const channel = supabase.channel('customer-map-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
			setCustomers((current) => {
				if (payload.eventType === 'INSERT') return [...current, payload.new as Customer].sort((a, b) => a.name.localeCompare(b.name))
				if (payload.eventType === 'UPDATE') return current.map((row) => row.id === payload.new.id ? payload.new as Customer : row)
				return current.filter((row) => row.id !== payload.old.id)
			})
		}).subscribe()
		return () => { active = false; window.removeEventListener('keydown', handleShortcut); supabase.removeChannel(channel) }
	}, [])

	const visibleCustomers = useMemo(() => province === 'All' ? customers : customers.filter((customer) => customer.province === province), [customers, province])
	const criticalCount = visibleCustomers.filter((customer) => statusFor(customer).label === 'Critical').length

	function startEdit(customer?: Customer) {
		setEditing(customer ?? null)
		setFormOpen(true)
		setForm(customer ? { ...customer, last_order_date: customer.last_order_date?.slice(0, 10) ?? '' } : emptyForm)
		setCoordinateText(customer ? `${customer.latitude}, ${customer.longitude}` : '')
		setMessage('')
	}

	async function saveCustomer(event: React.FormEvent) {
		event.preventDefault()
		setSaving(true)
		setMessage('')
		const payload = { ...form, last_order_date: form.last_order_date || null }
		const query = editing
			? (supabase as any).from('customers').update(payload).eq('id', editing.id)
			: (supabase as any).from('customers').insert(payload)
		const { error } = await query
		setSaving(false)
		if (error) setMessage(error.message)
		else { setMessage('Data tersimpan.'); setEditing(null); setFormOpen(false); setForm(emptyForm); setCoordinateText('') }
	}

	async function removeCustomer(id: string) {
		if (!window.confirm('Hapus customer ini dari data peta?')) return
		const { error } = await (supabase as any).from('customers').delete().eq('id', id)
		setMessage(error ? error.message : 'Customer dihapus.')
	}

	function updateField(field: keyof FormState, value: string) {
		setForm((current) => ({ ...current, [field]: ['latitude', 'longitude', 'machine_count', 'stock_quantity', 'daily_usage', 'lead_time_days', 'safety_buffer_days'].includes(field) ? Number(value) : value }))
	}

	function updateCoordinates(value: string) {
		setCoordinateText(value)
		const coordinates = value.split(',').map((part) => Number(part.trim()))
		if (coordinates.length === 2 && coordinates.every((coordinate) => Number.isFinite(coordinate))) {
			setForm((current) => ({ ...current, latitude: coordinates[0], longitude: coordinates[1] }))
		}
	}

	const showControls = !publicOnly || maintenanceOpen

	return <section className={`overflow-hidden rounded-xl border border-border ${publicOnly && !maintenanceOpen ? 'bg-gradient-to-br from-[#EAF5FA] via-white to-[#F4F0E8] shadow-[0_24px_80px_rgba(44,44,43,.10)]' : 'bg-white'}`}>
		{showControls && <div className="flex flex-col gap-4 border-b border-border p-6 lg:flex-row lg:items-center lg:justify-between">
			<div><div className="flex items-center gap-2 text-sm font-medium text-blue"><span className="h-2 w-2 rounded-full bg-blue" />Supabase realtime</div><h2 className="mt-2 text-lg font-semibold">Customer Stock Map</h2><p className="mt-1 text-sm text-muted">{customers.length} customer terhubung, {criticalCount} perlu perhatian segera.</p></div>
			<div className="flex flex-wrap items-center gap-2">
				<select aria-label="Filter provinsi" value={province} onChange={(event) => setProvince(event.target.value)} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><option>All</option><option>Aceh</option><option>Sumatera Utara</option></select>
				<button onClick={() => { setMode('map'); setEditing(null) }} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'map' ? 'bg-text text-white' : 'border border-border'}`}><MapIcon size={16} />Peta</button>
				<button onClick={() => setMode('maintain')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${mode === 'maintain' ? 'bg-text text-white' : 'border border-border'}`}><Pencil size={16} />Maintain data</button>
			</div>
		</div>}

		{message && showControls && <div className="border-b border-border bg-orange/10 px-6 py-3 text-sm text-orange">{message}</div>}

		{mode === 'map' ? <div className={`relative ${publicOnly && !maintenanceOpen ? 'h-[700px] min-h-[70vh]' : 'h-[560px]'}`}>
			<MapContainer center={[3.2, 98.5]} zoom={7} scrollWheelZoom className="h-full w-full"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><FitBounds province={province} />{visibleCustomers.map((customer) => { const status = statusFor(customer); return <Marker key={customer.id} position={[customer.latitude, customer.longitude]} icon={createHospitalIcon(status.color)}><Tooltip direction="top">{customer.name}</Tooltip><Popup><div className="min-w-[220px] text-sm"><strong className="block text-base">{customer.name}</strong><span className="text-muted">{customer.city}, {customer.province}</span><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2"><dt className="text-muted">Mesin HD</dt><dd className="text-right font-medium">{customer.machine_count}</dd><dt className="text-muted">Stock</dt><dd className="text-right font-medium">{customer.stock_quantity}</dd><dt className="text-muted">Coverage</dt><dd className="text-right font-medium">{Number.isFinite(status.coverage) ? `${status.coverage.toFixed(1)} hari` : 'Tidak terbatas'}</dd><dt className="text-muted">Order terakhir</dt><dd className="text-right font-medium">{formatDate(customer.last_order_date)}</dd><dt className="text-muted">Status</dt><dd className="text-right font-semibold" style={{ color: status.color }}>{status.label}</dd></dl><div className="mt-3 border-t border-border pt-2 text-xs text-muted">Lead time: {customer.lead_time_days} hari + buffer {customer.safety_buffer_days} hari</div></div></Popup></Marker> })}</MapContainer>
			{loading && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted"><span className="rounded-full border border-white/70 bg-white/75 px-4 py-2 shadow-sm backdrop-blur">Memuat data customer...</span></div>}
		</div> : <div className="p-6">
			<div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Maintain customer master</h3><p className="mt-1 text-sm text-muted">Isi koordinat peta dan jumlah mesin HD. Perubahan tersimpan ke Supabase realtime.</p></div><button onClick={() => startEdit()} className="inline-flex items-center gap-2 rounded-lg bg-blue px-3 py-2 text-sm font-medium text-white"><Plus size={16} />Tambah customer</button></div>
			{formOpen ? <form onSubmit={saveCustomer} className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3"><div className="rounded-lg border border-blue/20 bg-blue/5 p-3 text-xs text-muted md:col-span-3">Cara mengambil koordinat: buka Google Maps, klik kanan pada lokasi customer, lalu klik angka koordinat untuk menyalin. Tempel format seperti <strong>1.28895440385333, 97.61411017362235</strong> pada kolom koordinat; sistem otomatis memisahkan Latitude dan Longitude.</div>{([['name','Nama customer'],['city','Kabupaten/kota'],['province','Provinsi'],['latitude','Latitude'],['longitude','Longitude'],['machine_count','Jumlah mesin HD']] as [keyof FormState,string][]).map(([field,label]) => <label key={field} className="text-xs font-medium text-muted">{label}<input required min={field === 'latitude' ? -90 : field === 'longitude' ? -180 : field === 'machine_count' ? 0 : undefined} max={field === 'latitude' ? 90 : field === 'longitude' ? 180 : undefined} step="any" type={field === 'province' || field === 'name' || field === 'city' ? 'text' : 'number'} value={String(form[field] ?? '')} onChange={(event) => updateField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text" /></label>)}<label className="text-xs font-medium text-muted md:col-span-3">Paste koordinat Google Maps<input required type="text" inputMode="decimal" placeholder="1.28895440385333, 97.61411017362235" value={coordinateText} onChange={(event) => updateCoordinates(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text" /></label><div className="flex items-end gap-2 md:col-span-3"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-green px-3 py-2 text-sm font-medium text-white"><Save size={16} />{saving ? 'Menyimpan...' : 'Simpan'}</button><button type="button" onClick={() => { setEditing(null); setFormOpen(false); setForm(emptyForm); setCoordinateText('') }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><X size={16} />Batal</button></div></form> : null}
			<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">Customer</th><th className="p-3">Wilayah</th><th className="p-3 text-right">Latitude</th><th className="p-3 text-right">Longitude</th><th className="p-3 text-right">Mesin HD</th><th className="p-3 text-right">Aksi</th></tr></thead><tbody className="divide-y divide-border">{visibleCustomers.map((customer) => <tr key={customer.id}><td className="p-3 font-medium">{customer.name}</td><td className="p-3 text-muted">{customer.city}, {customer.province}</td><td className="p-3 text-right">{customer.latitude}</td><td className="p-3 text-right">{customer.longitude}</td><td className="p-3 text-right">{customer.machine_count}</td><td className="p-3 text-right"><button aria-label={`Edit ${customer.name}`} onClick={() => startEdit(customer)} className="mr-3 text-blue"><Pencil size={16} /></button><button aria-label={`Hapus ${customer.name}`} onClick={() => removeCustomer(customer.id)} className="text-red"><Trash2 size={16} /></button></td></tr>)}</tbody></table>{!loading && visibleCustomers.length === 0 && <div className="py-12 text-center text-sm text-muted">Belum ada customer di Supabase. Gunakan Tambah customer atau isi data melalui Supabase.</div>}</div>
		</div>}
	</section>
}
