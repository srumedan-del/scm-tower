import { AlertTriangle, ArrowUpRight, Boxes, CircleCheck, CircleX, Clock3, PackageCheck, Truck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { KpiCard } from '@/components/kpi-card'

type CustomerHealth = {
	customer: string
	criticalSkus: number
	coverageDays: number
	avgDemand: string
	status: 'Safe' | 'Warning' | 'Critical'
	action: string
}

const fallbackHealth: CustomerHealth[] = [
	{ customer: 'RS Siloam Group', criticalSkus: 8, coverageDays: 3, avgDemand: 'Tinggi', status: 'Critical', action: 'Replenish' },
	{ customer: 'Kimia Farma', criticalSkus: 4, coverageDays: 6, avgDemand: 'Sedang', status: 'Warning', action: 'Monitor' },
	{ customer: 'RS Hermina', criticalSkus: 2, coverageDays: 8, avgDemand: 'Tinggi', status: 'Warning', action: 'Monitor' },
	{ customer: 'Bio Farma', criticalSkus: 0, coverageDays: 14, avgDemand: 'Tinggi', status: 'Safe', action: 'Normal' },
]

const statusStyles = {
	Safe: 'bg-green/10 text-green',
	Warning: 'bg-orange/10 text-orange',
	Critical: 'bg-red/10 text-red',
}

const statusIcons = {
	Safe: CircleCheck,
	Warning: AlertTriangle,
	Critical: CircleX,
}

export default async function Dashboard() {
	const { data: healthData } = await (supabase as any)
		.from('vw_pareto_customer_stock_health')
		.select('*')
		.order('coverage_days', { ascending: true })

	const health: CustomerHealth[] = healthData?.length ? healthData.map((row: any) => ({
		customer: row.customer ?? row.customer_name,
		criticalSkus: row.critical_skus ?? row.sku_critical ?? 0,
		coverageDays: row.coverage_days ?? 0,
		avgDemand: row.avg_demand ?? 'Tidak ada data',
		status: row.status ?? 'Safe',
		action: row.action ?? (row.status === 'Critical' ? 'Replenish' : row.status === 'Warning' ? 'Monitor' : 'Normal'),
	})) : fallbackHealth

	const criticalCustomers = health.filter((row) => row.status === 'Critical').length
	const warningCustomers = health.filter((row) => row.status === 'Warning').length
	const safeCustomers = health.filter((row) => row.status === 'Safe').length
	const criticalSkus = health.reduce((total, row) => total + row.criticalSkus, 0)
	const averageCoverage = Math.round(health.reduce((total, row) => total + row.coverageDays, 0) / health.length)

	return <div className="space-y-8">
		<header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div>
				<div className="flex items-center gap-2 text-sm font-medium text-blue"><span className="h-2 w-2 rounded-full bg-blue" />Live control tower</div>
				<h1 className="mt-3 text-3xl font-bold tracking-tight">Pareto Customer Stock Monitor</h1>
				<p className="mt-2 max-w-2xl text-muted">Sinyal prioritas untuk menjaga ketersediaan stok customer utama dan mencegah service risk.</p>
			</div>
			<div className="flex items-center gap-2 text-sm text-muted"><Clock3 size={16} /> Update terakhir: hari ini, 08:30</div>
		</header>

		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
			<KpiCard title="Total Pelanggan Pareto" value={health.length} caption="Customer prioritas aktif" />
			<KpiCard title="Stok Aman" value={safeCustomers} caption="Coverage di atas 7 hari" tone="green" />
			<KpiCard title="Stok Warning" value={warningCustomers} caption="Perlu monitoring harian" tone="orange" />
			<KpiCard title="Stok Critical" value={criticalCustomers} caption="Perlu tindakan segera" tone="red" />
			<KpiCard title="Estimasi Coverage" value={`${averageCoverage} hari`} caption="Rata-rata customer Pareto" tone="green" />
			<KpiCard title="SKU Critical" value={criticalSkus} caption="Di bawah safety stock" tone="red" />
			<KpiCard title="Service Risk" value={criticalCustomers ? 'Tinggi' : 'Rendah'} caption="Potensi lost sales" tone={criticalCustomers ? 'red' : 'green'} />
			<KpiCard title="Open Replenishment" value={criticalCustomers} caption="Rencana perlu dibuat" tone="orange" />
		</div>

		<section className="overflow-hidden rounded-xl border border-border bg-white">
			<div className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between">
				<div><h2 className="text-lg font-semibold">Pareto Customer Stock Health</h2><p className="mt-1 text-sm text-muted">Urutan berdasarkan coverage stok terendah.</p></div>
				<button className="inline-flex items-center gap-2 self-start rounded-lg bg-text px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">View customer stock <ArrowUpRight size={16} /></button>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[760px] text-left text-sm">
					<thead className="bg-surface text-xs uppercase tracking-wide text-muted"><tr><th className="px-6 py-4 font-medium">Customer</th><th className="px-4 py-4 font-medium">SKU Critical</th><th className="px-4 py-4 font-medium">Stock Coverage</th><th className="px-4 py-4 font-medium">Avg Demand</th><th className="px-4 py-4 font-medium">Status</th><th className="px-6 py-4 text-right font-medium">Action</th></tr></thead>
					<tbody className="divide-y divide-border">
						{health.map((row) => { const StatusIcon = statusIcons[row.status]; return <tr key={row.customer} className="transition hover:bg-surface/70"><td className="px-6 py-4 font-medium">{row.customer}</td><td className="px-4 py-4">{row.criticalSkus}</td><td className="px-4 py-4 font-medium">{row.coverageDays} hari</td><td className="px-4 py-4 text-muted">{row.avgDemand}</td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[row.status]}`}><StatusIcon size={13} />{row.status}</span></td><td className="px-6 py-4 text-right"><button className="font-medium text-blue hover:underline">{row.action}</button></td></tr> })}
					</tbody>
				</table>
			</div>
		</section>

		<section className="grid grid-cols-1 gap-4 md:grid-cols-3">
			<button className="flex items-center justify-between rounded-xl border border-border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue"><span><span className="block text-sm font-semibold">Create replenishment plan</span><span className="mt-1 block text-xs text-muted">Tindak lanjuti {criticalSkus} SKU critical</span></span><Boxes className="text-blue" size={21} /></button>
			<button className="flex items-center justify-between rounded-xl border border-border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue"><span><span className="block text-sm font-semibold">Check outbound status</span><span className="mt-1 block text-xs text-muted">Pastikan order prioritas terpenuhi</span></span><Truck className="text-orange" size={21} /></button>
			<button className="flex items-center justify-between rounded-xl border border-border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-blue"><span><span className="block text-sm font-semibold">Check pending shipment</span><span className="mt-1 block text-xs text-muted">Review pengiriman customer Pareto</span></span><PackageCheck className="text-green" size={21} /></button>
		</section>
	</div>
}
