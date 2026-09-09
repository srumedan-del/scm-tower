'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Check, Map as MapIcon, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import 'leaflet/dist/leaflet.css'

type Customer = {
	id: string
	customer_code: string
	customer_name: string
	city: string
	province: string
	latitude: number
	longitude: number
	machine_count: number
	is_hd_customer: boolean
	stock_quantity: number
	daily_usage: number
	last_order_date: string | null
	lead_time_days: number
	safety_buffer_days: number
}

type FormState = Omit<Customer, 'id' | 'customer_code' | 'is_hd_customer'>

const emptyForm: FormState = {
	customer_name: '', city: '', province: 'Sumatera Utara', latitude: 3.5952, longitude: 98.6722,
	machine_count: 0, stock_quantity: 0, daily_usage: 0, last_order_date: '', lead_time_days: 3, safety_buffer_days: 2,
}

const provinceBounds: Record<string, [[number, number], [number, number]]> = {
	'All': [[1.2, 94.5], [4.8, 100.8]],
	'Aceh': [[2.0, 94.5], [6.1, 98.2]],
	'Sumatera Utara': [[0.8, 97.0], [4.5, 100.8]],
}

// 1 mesin HD = 2 tindakan/hari = 2 set kebutuhan/hari
const SETS_PER_MACHINE_PER_DAY = 2

function effectiveDailyUsage(customer: Customer) {
	// Jika daily_usage diisi manual, pakai itu; jika 0/null → hitung dari mesin
	return customer.daily_usage > 0 ? customer.daily_usage : customer.machine_count * SETS_PER_MACHINE_PER_DAY
}

function statusFor(customer: Customer) {
	const usage = effectiveDailyUsage(customer)
	const coverage = usage > 0 ? customer.stock_quantity / usage : Infinity
	const trigger = customer.lead_time_days + customer.safety_buffer_days
	if (coverage <= customer.lead_time_days) return { label: 'Critical', color: '#E56458', coverage, usage }
	if (coverage <= trigger) return { label: 'Replenish now', color: '#D5803B', coverage, usage }
	return { label: 'Healthy', color: '#46A171', coverage, usage }
}

// Hitung qty reorder: cukup untuk lead_time + safety_buffer ke depan
function reorderQty(customer: Customer, usage: number) {
	const daysNeeded = customer.lead_time_days + customer.safety_buffer_days * 2
	return Math.max(0, Math.ceil(usage * daysNeeded - customer.stock_quantity))
}

function createHospitalIcon(color: string, pulse = false) {
	return L.divIcon({
		className: 'hospital-marker-wrap',
		html: `
			<div class="hospital-marker${pulse ? ' hospital-marker-pulse' : ''}" style="--marker-color:${color}">
				<div class="hospital-marker-pin">
					<span>+</span>
				</div>
				<div class="hospital-marker-shadow"></div>
			</div>`,
		iconSize: [36, 42],
		iconAnchor: [18, 42],
		popupAnchor: [0, -44],
	})
}

function FitBounds({ province, customers }: { province: string; customers: Customer[] }) {
	const map = useMap()
	const fittedRef = useRef(false)

	useEffect(() => {
		// Saat province berubah manual → pakai provinceBounds
		fittedRef.current = false
	}, [province])

	useEffect(() => {
		if (fittedRef.current) return
		if (customers.length > 0) {
			// Fit ke semua marker yang terlihat
			const bounds = L.latLngBounds(customers.map(c => [c.latitude, c.longitude] as [number, number]))
			map.fitBounds(bounds, { padding: [40, 40] })
			fittedRef.current = true
		} else {
			// Fallback ke provinceBounds jika belum ada data
			map.fitBounds(provinceBounds[province] ?? provinceBounds.All, { padding: [12, 12] })
		}
	}, [map, province, customers])

	return null
}

function CtrlScrollZoom() {
	const map = useMap()
	useEffect(() => {
		const container = map.getContainer()
		const handleWheel = (e: WheelEvent) => {
			if (e.ctrlKey) {
				e.preventDefault()
				e.stopPropagation()
				const delta = e.deltaY < 0 ? 1 : -1
				map.setZoom(map.getZoom() + delta)
			}
		}
		container.addEventListener('wheel', handleWheel, { passive: false })
		return () => container.removeEventListener('wheel', handleWheel)
	}, [map])
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
			const { data, error } = await (supabase as any)
				.from('customers')
				.select('*')
				.not('latitude', 'is', null)
				.not('longitude', 'is', null)
				.order('customer_name')
			if (active) {
				if (error) setMessage(`Supabase belum mengembalikan data: ${error.message}`)
				const validCustomers = ((data ?? []) as Customer[]).filter((customer) => typeof customer?.customer_name === 'string' && customer.customer_name.trim().length > 0)
				const uniqueCustomers = [...new Map(validCustomers.map((customer) => [customer.customer_name.trim().toUpperCase(), customer])).values()]
				setCustomers(uniqueCustomers)
				setLoading(false)
			}
		}
		load()
		const channel = supabase.channel('customer-map-realtime').on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, (payload) => {
			setCustomers((current) => {
				if (payload.eventType === 'INSERT') {
					const row = payload.new as Customer
					if (row.latitude == null || row.longitude == null) return current
					return [...current, row].sort((a, b) => a.customer_name.localeCompare(b.customer_name))
				}
				if (payload.eventType === 'UPDATE') {
					const row = payload.new as Customer
					const hasCoord = row.latitude != null && row.longitude != null
					const exists = current.some((c) => c.id === row.id)
					if (!hasCoord) return current.filter((c) => c.id !== row.id) // koordinat dihapus → hilangkan dari peta
					if (exists) return current.map((c) => c.id === row.id ? row : c) // update existing
					return [...current, row].sort((a, b) => a.customer_name.localeCompare(b.customer_name)) // baru punya koordinat → tambahkan
				}
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
			<MapContainer center={[3.2, 98.5]} zoom={7} scrollWheelZoom={false} className="h-full w-full">
				<CtrlScrollZoom />
				<TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
				<FitBounds province={province} customers={visibleCustomers} />
				{visibleCustomers.map((customer) => {
					const status = statusFor(customer)
					const qty = reorderQty(customer, status.usage)
					const needReorder = qty > 0
					return (
						<Marker key={customer.id} position={[customer.latitude, customer.longitude]} icon={createHospitalIcon(status.color, status.label === 'Critical')}>
							<Tooltip direction="top">{customer.customer_name}</Tooltip>
							<Popup>
								<div className="min-w-[240px] text-sm">
									<strong className="block text-base">{customer.customer_name}</strong>
									<span className="text-muted">{customer.city}, {customer.province}</span>

									{/* Status badge */}
									<div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: `${status.color}22`, color: status.color }}>
										<span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
										{status.label}
									</div>

									{/* Stock & mesin */}
									<dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
										<dt className="text-muted">Mesin HD</dt>
										<dd className="text-right font-medium">{customer.machine_count} unit</dd>

										<dt className="text-muted">Kebutuhan/hari</dt>
										<dd className="text-right font-medium">{status.usage} set</dd>

										<dt className="text-muted">Stock saat ini</dt>
										<dd className="text-right font-semibold">{customer.stock_quantity} set</dd>

										<dt className="text-muted">Coverage</dt>
										<dd className="text-right font-medium">
											{Number.isFinite(status.coverage) ? `${status.coverage.toFixed(1)} hari` : '∞'}
										</dd>

										<dt className="text-muted">Order terakhir</dt>
										<dd className="text-right font-medium">{formatDate(customer.last_order_date)}</dd>
									</dl>

									{/* Reorder box */}
									{needReorder && (
										<div className="mt-3 rounded-lg border border-orange/30 bg-orange/10 px-3 py-2">
											<p className="text-xs font-semibold text-orange">Perlu reorder segera</p>
											<p className="mt-0.5 text-xs text-muted">
												Qty direkomendasikan: <strong className="text-text">{qty} set</strong>
												<span className="ml-1">(untuk {customer.lead_time_days + customer.safety_buffer_days * 2} hari ke depan)</span>
											</p>
										</div>
									)}

									<div className="mt-3 border-t border-border pt-2 text-xs text-muted">
										Lead time {customer.lead_time_days}h · buffer {customer.safety_buffer_days}h ·
										basis {SETS_PER_MACHINE_PER_DAY} set/mesin/hari
									</div>
								</div>
							</Popup>
						</Marker>
					)
				})}
			</MapContainer>
			{loading && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted"><span className="rounded-full border border-white/70 bg-white/75 px-4 py-2 shadow-sm backdrop-blur">Memuat data customer...</span></div>}
		</div> : <div className="p-6">
			<div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold">Maintain customer master</h3><p className="mt-1 text-sm text-muted">Isi koordinat peta dan jumlah mesin HD. Perubahan tersimpan ke Supabase realtime.</p></div><button onClick={() => startEdit()} className="inline-flex items-center gap-2 rounded-lg bg-blue px-3 py-2 text-sm font-medium text-white"><Plus size={16} />Tambah customer</button></div>
			{formOpen ? <form onSubmit={saveCustomer} className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3"><div className="rounded-lg border border-blue/20 bg-blue/5 p-3 text-xs text-muted md:col-span-3">Cara mengambil koordinat: buka Google Maps, klik kanan pada lokasi customer, lalu klik angka koordinat untuk menyalin. Tempel format seperti <strong>1.28895440385333, 97.61411017362235</strong> pada kolom koordinat; sistem otomatis memisahkan Latitude dan Longitude.</div>{([['customer_name','Nama customer'],['city','Kabupaten/kota'],['province','Provinsi'],['latitude','Latitude'],['longitude','Longitude'],['machine_count','Jumlah mesin HD']] as [keyof FormState,string][]).map(([field,label]) => <label key={field} className="text-xs font-medium text-muted">{label}<input required min={field === 'latitude' ? -90 : field === 'longitude' ? -180 : field === 'machine_count' ? 0 : undefined} max={field === 'latitude' ? 90 : field === 'longitude' ? 180 : undefined} step="any" type={field === 'province' || field === 'customer_name' || field === 'city' ? 'text' : 'number'} value={String(form[field] ?? '')} onChange={(event) => updateField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text" /></label>)}<label className="text-xs font-medium text-muted md:col-span-3">Paste koordinat Google Maps<input required type="text" inputMode="decimal" placeholder="1.28895440385333, 97.61411017362235" value={coordinateText} onChange={(event) => updateCoordinates(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text" /></label><div className="flex items-end gap-2 md:col-span-3"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-green px-3 py-2 text-sm font-medium text-white"><Save size={16} />{saving ? 'Menyimpan...' : 'Simpan'}</button><button type="button" onClick={() => { setEditing(null); setFormOpen(false); setForm(emptyForm); setCoordinateText('') }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><X size={16} />Batal</button></div></form> : null}
			<div className="overflow-x-auto">
				<table className="w-full min-w-[900px] text-left text-sm">
					<thead className="bg-surface text-xs uppercase tracking-wide text-muted">
						<tr>
							<th className="p-3">Customer</th>
							<th className="p-3">Wilayah</th>
							<th className="p-3 text-right">Mesin HD</th>
							<th className="p-3 text-right">Kebutuhan/hari</th>
							<th className="p-3 text-right">Stock saat ini</th>
							<th className="p-3 text-right">Coverage</th>
							<th className="p-3 text-right">Order terakhir</th>
							<th className="p-3 text-right">Status</th>
							<th className="p-3 text-right">Aksi</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{visibleCustomers.map((customer) => {
							const status = statusFor(customer)
							const qty = reorderQty(customer, status.usage)
							return (
								<tr key={customer.id} className={status.label === 'Critical' ? 'bg-red/5' : status.label === 'Replenish now' ? 'bg-orange/5' : ''}>
									<td className="p-3 font-medium">{customer.customer_name}</td>
									<td className="p-3 text-muted">{customer.city}, {customer.province}</td>
									<td className="p-3 text-right">{customer.machine_count}</td>
									<td className="p-3 text-right">{status.usage} set</td>
									<td className="p-3 text-right font-semibold">{customer.stock_quantity} set</td>
									<td className="p-3 text-right">
										{Number.isFinite(status.coverage) ? `${status.coverage.toFixed(1)} hari` : '∞'}
									</td>
									<td className="p-3 text-right text-muted">{formatDate(customer.last_order_date)}</td>
									<td className="p-3 text-right">
										<span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: `${status.color}22`, color: status.color }}>
											{status.label}
											{qty > 0 && <span className="ml-1 opacity-80">· reorder {qty}</span>}
										</span>
									</td>
									<td className="p-3 text-right">
										<button aria-label={`Edit ${customer.customer_name}`} onClick={() => startEdit(customer)} className="mr-3 text-blue"><Pencil size={16} /></button>
										<button aria-label={`Hapus ${customer.customer_name}`} onClick={() => removeCustomer(customer.id)} className="text-red"><Trash2 size={16} /></button>
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
				{!loading && visibleCustomers.length === 0 && <div className="py-12 text-center text-sm text-muted">Belum ada customer di Supabase. Gunakan Tambah customer atau isi data melalui Supabase.</div>}
			</div>
		</div>}
	</section>
}
