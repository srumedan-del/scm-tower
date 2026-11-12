'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getLatestCustomerOrders, type LatestCustomerOrder } from './actions'
import { confirmAction } from '@/lib/feedback'
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

type ReorderState = { key: 'overdue' | 'soon' | 'ok' | 'nodata'; label: string; color: string }

const REORDER_STATES: Record<ReorderState['key'], ReorderState> = {
	overdue: { key: 'overdue', label: 'Jadwal reorder lewat', color: '#E56458' },
	soon: { key: 'soon', label: 'Reorder ≤ 3 hari', color: '#D5803B' },
	ok: { key: 'ok', label: 'Aman', color: '#46A171' },
	nodata: { key: 'nodata', label: 'Belum ada data order', color: '#98989A' },
}
const STATE_ORDER: ReorderState['key'][] = ['overdue', 'soon', 'ok', 'nodata']

function reorderState(customer: Customer, latestOrder?: LatestCustomerOrder): ReorderState {
	const reorderDate = idealReorderDate(customer, latestOrder)
	if (!reorderDate) return REORDER_STATES.nodata
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	if (reorderDate < today) return REORDER_STATES.overdue
	const soon = new Date(today)
	soon.setDate(soon.getDate() + 3)
	return reorderDate <= soon ? REORDER_STATES.soon : REORDER_STATES.ok
}

function createClusterIcon(count: number, color: string) {
	const size = count < 10 ? 38 : 44
	return L.divIcon({
		className: 'hospital-marker-wrap',
		html: `<div class="hospital-cluster" style="--marker-color:${color};width:${size}px;height:${size}px">${count}</div>`,
		iconSize: [size, size],
		iconAnchor: [size / 2, size / 2],
	})
}

const CLUSTER_RADIUS_PX = 46

/** Pin yang berdekatan pada zoom saat ini digabung menjadi satu lingkaran berangka. */
function ClusteredMarkers({ customers, latestOrders }: { customers: Customer[]; latestOrders: Record<string, LatestCustomerOrder> }) {
	const map = useMap()
	const [zoom, setZoom] = useState(map.getZoom())
	useMapEvents({ zoomend: () => setZoom(map.getZoom()) })

	const clusters = useMemo(() => {
		const groups: { point: L.Point; members: Customer[] }[] = []
		for (const customer of customers) {
			const point = map.project([customer.latitude, customer.longitude], zoom)
			const group = groups.find(item => item.point.distanceTo(point) < CLUSTER_RADIUS_PX)
			if (group) group.members.push(customer)
			else groups.push({ point, members: [customer] })
		}
		return groups
	}, [customers, map, zoom])

	return <>
		{clusters.map(({ members }) => {
			if (members.length === 1) {
				const customer = members[0]
				return <CustomerMarker key={customer.id} customer={customer} latestOrder={latestOrders[customer.customer_code]} />
			}
			const states = members.map(member => reorderState(member, latestOrders[member.customer_code]))
			const worst = STATE_ORDER.find(key => states.some(state => state.key === key)) ?? 'ok'
			const bounds = L.latLngBounds(members.map(member => [member.latitude, member.longitude] as [number, number]))
			const center = bounds.getCenter()
			return (
				<Marker
					key={members.map(member => member.id).join('|')}
					position={center}
					icon={createClusterIcon(members.length, REORDER_STATES[worst].color)}
					eventHandlers={{
						click: () => {
							const target = Math.min(map.getBoundsZoom(bounds.pad(0.3)), 15)
							map.flyTo(center, Math.max(target, zoom + 2), { duration: 0.5 })
						},
					}}
				>
					<Tooltip direction="top">
						<strong>{members.length} customer</strong>
						{members.slice(0, 6).map(member => <div key={member.id}>{member.customer_name}</div>)}
						{members.length > 6 && <div>dan {members.length - 6} lainnya</div>}
						<div className="mt-1 text-[11px] opacity-70">Klik untuk memperbesar</div>
					</Tooltip>
				</Marker>
			)
		})}
	</>
}

function MapLegend() {
	return (
		<div className="pointer-events-auto absolute bottom-6 left-3 z-[400] rounded-xl border border-gray-200 bg-white/95 px-3 py-2.5 text-xs shadow-sm backdrop-blur">
			<p className="mb-1.5 font-semibold text-slate-700">Status reorder</p>
			<ul className="space-y-1">
				{STATE_ORDER.map(key => (
					<li key={key} className="flex items-center gap-2 text-slate-600">
						<span className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: REORDER_STATES[key].color }} aria-hidden="true" />
						{REORDER_STATES[key].label}
					</li>
				))}
				<li className="flex items-center gap-2 text-slate-600">
					<span className="grid h-4 w-4 place-items-center rounded-full bg-slate-500 text-[9px] font-bold text-white" aria-hidden="true">3</span>
					Beberapa customer berdekatan
				</li>
			</ul>
		</div>
	)
}

function SummaryCards({ customers, latestOrders }: { customers: Customer[]; latestOrders: Record<string, LatestCustomerOrder> }) {
	const counts = { overdue: 0, soon: 0, ok: 0, nodata: 0 }
	const today = new Date()
	today.setHours(0, 0, 0, 0)
	const week = new Date(today)
	week.setDate(week.getDate() + 7)
	let stockoutThisWeek = 0
	for (const customer of customers) {
		const latestOrder = latestOrders[customer.customer_code]
		counts[reorderState(customer, latestOrder).key]++
		const stockout = stockOutDate(customer, latestOrder)
		if (stockout && stockout >= today && stockout <= week) stockoutThisWeek++
	}
	const machines = customers.reduce((sum, customer) => sum + (Number(customer.machine_count) || 0), 0)
	const cards = [
		{ label: 'Customer HD', value: customers.length, note: `${machines.toLocaleString('id-ID')} mesin`, color: '#262523' },
		{ label: REORDER_STATES.overdue.label, value: counts.overdue, note: 'perlu reorder sekarang', color: REORDER_STATES.overdue.color },
		{ label: REORDER_STATES.soon.label, value: counts.soon, note: 'siapkan order', color: REORDER_STATES.soon.color },
		{ label: 'Stok habis ≤ 7 hari', value: stockoutThisWeek, note: 'perkiraan dari order terakhir', color: '#856828' },
		{ label: REORDER_STATES.ok.label, value: counts.ok, note: counts.nodata ? `${counts.nodata} belum ada data order` : 'stok mencukupi', color: REORDER_STATES.ok.color },
	]
	return (
		<div className="grid grid-cols-2 gap-3 border-b border-border bg-white p-4 md:grid-cols-3 xl:grid-cols-5">
			{cards.map(card => (
				<div key={card.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
					<p className="flex items-center gap-2 text-xs font-medium text-slate-500">
						<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: card.color }} aria-hidden="true" />
						{card.label}
					</p>
					<p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{card.value}</p>
					<p className="text-xs text-slate-500">{card.note}</p>
				</div>
			))}
		</div>
	)
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
			map.fitBounds(bounds, { padding: [28, 28] })
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

function isStockMapCustomer(customer: Partial<Customer>) {
	return customer.is_hd_customer === true
		&& Number(customer.machine_count) > 0
		&& customer.latitude != null
		&& customer.longitude != null
}

function addOperatingDays(dateValue: string, days: number) {
	const date = new Date(`${dateValue.slice(0, 10)}T00:00:00`)
	let remainingDays = Math.max(0, days)
	while (remainingDays > 0) {
		date.setDate(date.getDate() + 1)
		if (date.getDay() !== 0) remainingDays--
	}
	return date
}

function idealReorderDate(customer: Customer, latestOrder?: LatestCustomerOrder) {
	const stockoutDate = stockOutDate(customer, latestOrder)
	if (!stockoutDate) return null

	let remainingDays = 3
	const reorderDate = new Date(stockoutDate)
	while (remainingDays > 0) {
		reorderDate.setDate(reorderDate.getDate() - 1)
		if (reorderDate.getDay() !== 0) remainingDays--
	}
	return reorderDate
}

function coverageFromLastOrder(customer: Customer, latestOrder?: LatestCustomerOrder) {
	if (!latestOrder) return null
	const dailyUsage = effectiveDailyUsage(customer)
	return dailyUsage > 0 ? latestOrder.totalSets / dailyUsage : null
}

function stockOutDate(customer: Customer, latestOrder?: LatestCustomerOrder) {
	const doi = coverageFromLastOrder(customer, latestOrder)
	return latestOrder && doi !== null
		? addOperatingDays(latestOrder.documentDate, Math.ceil(doi))
		: null
}

function CustomerMarker({ customer, latestOrder }: { customer: Customer; latestOrder?: LatestCustomerOrder }) {
	const status = statusFor(customer)
	const qty = reorderQty(customer, status.usage)
	const reorderDate = idealReorderDate(customer, latestOrder)
	const coverage = coverageFromLastOrder(customer, latestOrder)
	const needReorder = qty > 0
	const state = reorderState(customer, latestOrder)
	const markerColor = state.color
	const reorderIsOverdue = state.key === 'overdue'
	return (
			<Marker key={customer.id} position={[customer.latitude, customer.longitude]} icon={createHospitalIcon(markerColor, reorderIsOverdue)}>
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
							{coverage !== null ? `${coverage.toFixed(1)} hari` : '—'}
						</dd>

						<dt className="text-muted">Order terakhir</dt>
						<dd className="text-right font-medium">{latestOrder ? `${formatDate(latestOrder.documentDate)} · ${latestOrder.totalSets.toLocaleString('id-ID')} set` : 'Belum ada data'}</dd>

						<dt className="text-muted">Reorder ideal</dt>
						<dd className="text-right font-medium">{reorderDate ? formatDate(reorderDate.toISOString()) : '—'}</dd>
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
}

export function CustomerStockMap({ publicOnly = false, showMaintainBelow = false }: { publicOnly?: boolean; showMaintainBelow?: boolean }) {
	const [customers, setCustomers] = useState<Customer[]>([])
	const [latestOrders, setLatestOrders] = useState<Record<string, LatestCustomerOrder>>({})
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
	const [stockFilter, setStockFilter] = useState<'all' | 'reorder'>('all')
	const [pendingStockFilter, setPendingStockFilter] = useState<'all' | 'reorder'>('all')

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
					.eq('is_hd_customer', true)
					.gt('machine_count', 0)
					.not('latitude', 'is', null)
				.not('longitude', 'is', null)
				.order('customer_name')
			if (active) {
				if (error) setMessage(`Supabase belum mengembalikan data: ${error.message}`)
				const validCustomers = ((data ?? []) as Customer[]).filter((customer) => isStockMapCustomer(customer) && typeof customer?.customer_name === 'string' && customer.customer_name.trim().length > 0)
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
					if (!isStockMapCustomer(row)) return current
					return [...current, row].sort((a, b) => a.customer_name.localeCompare(b.customer_name))
				}
				if (payload.eventType === 'UPDATE') {
					const row = payload.new as Customer
					const exists = current.some((c) => c.id === row.id)
					if (!isStockMapCustomer(row)) return current.filter((c) => c.id !== row.id)
					if (exists) return current.map((c) => c.id === row.id ? row : c) // update existing
					return [...current, row].sort((a, b) => a.customer_name.localeCompare(b.customer_name)) // baru punya koordinat → tambahkan
				}
				return current.filter((row) => row.id !== payload.old.id)
			})
		}).subscribe()
		return () => { active = false; window.removeEventListener('keydown', handleShortcut); supabase.removeChannel(channel) }
	}, [])

	useEffect(() => {
		let active = true
		const customerCodes = customers.map((customer) => customer.customer_code).filter(Boolean)
		if (!customerCodes.length) {
			setLatestOrders({})
			return () => { active = false }
		}

		getLatestCustomerOrders(customerCodes)
			.then((orders) => { if (active) setLatestOrders(orders) })
			.catch((error: Error) => { if (active) setMessage(error.message) })

		return () => { active = false }
	}, [customers])

	const visibleCustomers = useMemo(() => province === 'All' ? customers : customers.filter((customer) => customer.province === province), [customers, province])
	const listCustomers = useMemo(() => stockFilter === 'reorder'
		? visibleCustomers.filter((customer) => {
			const reorderDate = idealReorderDate(customer, latestOrders[customer.customer_code])
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			return reorderDate ? reorderDate < today : false
		})
		: visibleCustomers, [latestOrders, stockFilter, visibleCustomers])
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
		const payload = { ...form, last_order_date: form.last_order_date || null, ...(editing ? {} : { is_hd_customer: true }) }
		const query = editing
			? (supabase as any).from('customers').update(payload).eq('id', editing.id)
			: (supabase as any).from('customers').insert(payload)
		const { error } = await query
		setSaving(false)
		if (error) setMessage(error.message)
		else { setMessage('Data tersimpan.'); setEditing(null); setFormOpen(false); setForm(emptyForm); setCoordinateText('') }
	}

	async function removeCustomer(id: string) {
		if (!(await confirmAction({ title: 'Hapus customer dari peta?', message: 'Customer ini akan dihapus dari data peta.' }))) return
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

	return <section className={`overflow-hidden rounded-xl border border-border ${publicOnly && !maintenanceOpen ? 'bg-gradient-to-br from-indigo-50 via-white to-gray-100 shadow-[0_24px_80px_rgba(44,44,43,.10)]' : 'bg-white'}`}>


		{message && showControls && <div className="border-b border-border bg-orange/10 px-6 py-3 text-sm text-orange">{message}</div>}

		{(mode === 'map' || showMaintainBelow) && !loading && <SummaryCards customers={visibleCustomers} latestOrders={latestOrders} />}
		{(mode === 'map' || showMaintainBelow) && <div className={`relative ${publicOnly && !maintenanceOpen ? 'h-[700px] min-h-[70vh]' : 'h-[620px]'}`}>
			<MapContainer center={[3.2, 98.5]} zoom={7} scrollWheelZoom={false} className="h-full w-full">
				<CtrlScrollZoom />
				<TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
				<FitBounds province={province} customers={visibleCustomers} />
				<ClusteredMarkers customers={visibleCustomers} latestOrders={latestOrders} />
			</MapContainer>
			<MapLegend />
			{loading && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted"><span className="rounded-full border border-white/70 bg-white/75 px-4 py-2 shadow-sm backdrop-blur">Memuat data customer...</span></div>}
		</div>}
		{(mode === 'maintain' || showMaintainBelow) && <div className="p-6">
			<div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="lux-display text-xl font-semibold text-indigo-900">Monitor Stok HD</h3><p className="mt-0.5 text-sm text-slate-500">{listCustomers.length} customer · kebutuhan dihitung dari jumlah mesin HD</p></div><div className="flex flex-wrap items-center gap-2"><select id="customer-stock-filter" aria-label="Filter customer stock" value={pendingStockFilter} onChange={(event) => setPendingStockFilter(event.target.value as 'all' | 'reorder')} className="rounded-lg border border-border bg-white px-3 py-2 text-sm"><option value="all">Semua customer</option><option value="reorder">Perlu reorder</option></select><button type="button" onClick={() => setStockFilter(pendingStockFilter)} className="rounded-lg bg-text px-3 py-2 text-sm font-medium text-white">Terapkan</button><button type="button" onClick={() => { setPendingStockFilter('all'); setStockFilter('all') }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium">Reset</button></div></div>
			{formOpen ? <form onSubmit={saveCustomer} className="mb-6 grid gap-3 rounded-lg border border-border bg-surface p-4 md:grid-cols-3"><div className="rounded-lg border border-blue/20 bg-blue/5 p-3 text-xs text-muted md:col-span-3">Cara mengambil koordinat: buka Google Maps, klik kanan pada lokasi customer, lalu klik angka koordinat untuk menyalin. Tempel format seperti <strong>1.28895440385333, 97.61411017362235</strong> pada kolom koordinat; sistem otomatis memisahkan Latitude dan Longitude.</div>{([['customer_name','Nama customer'],['city','Kabupaten/kota'],['province','Provinsi'],['latitude','Latitude'],['longitude','Longitude'],['machine_count','Jumlah mesin HD']] as [keyof FormState,string][]).map(([field,label]) => <label key={field} className="text-xs font-medium text-muted">{label}<input required min={field === 'latitude' ? -90 : field === 'longitude' ? -180 : field === 'machine_count' ? 0 : undefined} max={field === 'latitude' ? 90 : field === 'longitude' ? 180 : undefined} step="any" type={field === 'province' || field === 'customer_name' || field === 'city' ? 'text' : 'number'} value={String(form[field] ?? '')} onChange={(event) => updateField(field, event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text" /></label>)}<label className="text-xs font-medium text-muted md:col-span-3">Paste koordinat Google Maps<input required type="text" inputMode="decimal" placeholder="1.28895440385333, 97.61411017362235" value={coordinateText} onChange={(event) => updateCoordinates(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text" /></label><div className="flex items-end gap-2 md:col-span-3"><button disabled={saving} data-busy={saving} className="inline-flex items-center gap-2 rounded-lg bg-green px-3 py-2 text-sm font-medium text-white"><Save size={16} />{saving ? 'Menyimpan...' : 'Simpan'}</button><button type="button" onClick={() => { setEditing(null); setFormOpen(false); setForm(emptyForm); setCoordinateText('') }} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><X size={16} />Batal</button></div></form> : null}
			<div className="receiving-table-scroll data-list-scroll max-h-[calc(100vh-7.5rem)] overflow-auto rounded-2xl border border-slate-200 bg-white">
				<table className="w-full min-w-[1080px] border-collapse text-left text-sm">
					<thead className="sticky top-0 z-10 bg-slate-50">
						<tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
							<th className="px-4 py-3 font-semibold">Customer</th>
							<th className="px-3 py-3 text-right font-semibold">Mesin HD</th>
							<th className="px-3 py-3 text-right font-semibold">Kebutuhan<span className="block font-medium normal-case tracking-normal text-slate-400">per hari · per bulan</span></th>
							<th className="px-3 py-3 text-right font-semibold">Safety stock<span className="block font-medium normal-case tracking-normal text-slate-400">6 hari</span></th>
							<th className="px-3 py-3 text-right font-semibold">ROP<span className="block font-medium normal-case tracking-normal text-slate-400">8 hari</span></th>
							<th className="px-3 py-3 text-right font-semibold">Order terakhir</th>
							<th className="px-3 py-3 text-right font-semibold">DOI</th>
							<th className="px-3 py-3 text-right font-semibold">Stok habis</th>
							<th className="px-3 py-3 text-right font-semibold">Reorder ideal</th>
							<th className="px-4 py-3 font-semibold">Status</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{listCustomers.map((customer) => {
							const status = statusFor(customer)
							const qty = reorderQty(customer, status.usage)
							const latestOrder = latestOrders[customer.customer_code]
							const reorderDate = idealReorderDate(customer, latestOrder)
							const coverage = coverageFromLastOrder(customer, latestOrder)
							const stockoutDate = stockOutDate(customer, latestOrder)
							const today = new Date()
							today.setHours(0, 0, 0, 0)
							const reorderIsDue = reorderDate ? reorderDate < today : false
							return (
								<tr key={customer.id} className="transition-colors hover:bg-slate-50/80">
									<td className="py-3 pl-0 pr-4">
										<div className="flex items-center gap-3">
											<span className="h-9 w-1 shrink-0 rounded-r-full" style={{ background: status.color }} aria-hidden="true" />
											<div className="min-w-0">
												<div className="font-medium text-slate-900">{customer.customer_name}</div>
												{customer.city && <div className="text-xs text-slate-500">{customer.city}</div>}
											</div>
										</div>
									</td>
									<td className="px-3 py-3 text-right tabular-nums text-slate-700">{customer.machine_count}</td>
									<td className="px-3 py-3 text-right tabular-nums text-slate-700">
										{status.usage.toLocaleString('id-ID')} set
										<div className="text-xs text-slate-500">{(status.usage * 25).toLocaleString('id-ID')} set</div>
									</td>
									<td className="px-3 py-3 text-right tabular-nums text-slate-700">{(status.usage * 6).toLocaleString('id-ID')} set</td>
									<td className="px-3 py-3 text-right tabular-nums text-slate-700">{(status.usage * 8).toLocaleString('id-ID')} set</td>
									<td className="px-3 py-3 text-right tabular-nums">
										{latestOrder ? (
											<>
												<div className="text-slate-900">{formatDate(latestOrder.documentDate)}</div>
												<div className="text-xs text-slate-500">{latestOrder.totalSets.toLocaleString('id-ID')} set</div>
											</>
										) : <span className="text-xs text-slate-400">Belum ada data</span>}
									</td>
									<td className="px-3 py-3 text-right tabular-nums text-slate-700">{coverage !== null ? `${coverage.toFixed(1)} hari` : '—'}</td>
									<td className="px-3 py-3 text-right tabular-nums text-slate-700">{stockoutDate ? formatDate(stockoutDate.toISOString()) : '—'}</td>
									<td className="px-3 py-3 text-right tabular-nums">
										{reorderDate ? <div className={reorderIsDue ? 'font-semibold text-red-700' : 'text-slate-700'}>{formatDate(reorderDate.toISOString())}</div> : <span className="text-slate-400">—</span>}
										{reorderIsDue && <div className="text-xs text-red-700">Lewat jadwal</div>}
									</td>
									<td className="px-4 py-3">
										<span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: `${status.color}1f`, color: status.color }}>
											{status.label}
										</span>
										{qty > 0 && <div className="mt-1 text-xs text-slate-500">Reorder {qty.toLocaleString('id-ID')} set</div>}
									</td>
								</tr>
							)
						})}
					</tbody>
				</table>
				{!loading && listCustomers.length === 0 && <div className="py-12 text-center text-sm text-muted">{stockFilter === 'reorder' ? 'Tidak ada customer yang perlu reorder.' : 'Belum ada customer di Supabase. Gunakan Tambah customer atau isi data melalui Supabase.'}</div>}
			</div>
		</div>}
	</section>
}
