"use server"

import { supabaseAdmin as supabase } from './supabaseAdmin'
import { calculateReceivingLoad, type ReceivingDetailForAnalytics, type ReceivingPackaging } from './receiving-analytics'

export async function getLandingPageData() {
  const today = new Date().toISOString().slice(0, 10)
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  const fromDate = sixMonthsAgo.toISOString().slice(0, 7) + '-01'

  const [
    { count: vendorCount },
    { count: receivingCount },
    { count: issueCount },
    { count: outboundTotal },
    { count: activeShipmentCount },
    { count: draftCount },
    { count: dispatchedCount },
    { count: inTransitCount },
    { count: deliveredTodayCount },
    { data: customers },
    { data: openIssues },
    { data: activeShipments },
    { data: otdData },
    { data: lateShipments },
    { data: receivingTrendRows },
    { data: receivingDetails },
    { data: receivingPackaging },
    // Add inventory query if table exists
    // { count: inventoryCount },
  ] = await Promise.all([
    supabase.from('vendors').select('*', { count: 'exact', head: true }),
    supabase.from('receiving_header').select('*', { count: 'exact', head: true }),
    supabase.from('issue_log').select('*', { count: 'exact', head: true }).in('status', ['Open', 'In Progress']),
    supabase.from('outbound_header').select('*', { count: 'exact', head: true }),
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).not('status', 'eq', 'Delivered'),
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'Draft'),
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'Dispatched'),
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'In Transit'),
    supabase.from('shipment_tracking').select('*', { count: 'exact', head: true }).eq('status', 'Delivered').gte('delivery_time', today),
    supabase.from('customers').select('id, customer_name, city, is_active, machine_count, latitude, longitude').eq('is_active', true).limit(200),
    supabase.from('issue_log').select('issue_no, title, status, category, due_date').in('status', ['Open', 'In Progress']).order('due_date', { ascending: true }).limit(5),
    supabase.from('shipment_tracking')
      .select('id, pss_no, status, customer_name, destination_city, promised_delivery_date, dispatch_time')
      .in('status', ['Draft', 'Dispatched', 'In Transit'])
      .order('promised_delivery_date', { ascending: true })
      .limit(8),
    supabase.from('shipment_tracking')
      .select('delivery_time, promised_delivery_date, delivery_pod!inner(id)')
      .eq('status', 'Delivered')
      .gte('delivery_time', fromDate)
      .not('delivery_time', 'is', null)
      .not('promised_delivery_date', 'is', null),
    supabase.from('shipment_tracking')
      .select('id, pss_no, customer_name, promised_delivery_date, status, dispatch_time, destination_city, dk_lk')
      .lt('promised_delivery_date', today)
      .not('status', 'eq', 'Delivered')
      .not('promised_delivery_date', 'is', null)
      .order('promised_delivery_date', { ascending: true })
      .limit(20),
    supabase.from('receiving_header')
      .select('ptr_no, posting_date, ship_to_posting_days, transfer_from_code')
      .gte('posting_date', fromDate)
      .order('posting_date', { ascending: true }),
    supabase.from('receiving_detail')
      .select('document_no, item_no, description, quantity')
      .limit(20000),
    supabase.from('master_sku')
      .select('sku_code, pcs_per_outer_box, outer_box_cbm, outer_box_weight_kg, pcs_per_pallet')
      .limit(20000),
  ])

  // Calculate OTD rate
  function computeOtd(rows: { delivery_time: string; promised_delivery_date: string }[]) {
    if (!rows.length) return { rate: null, onTime: 0, late: 0, total: 0, avgDelay: null }

    const isOnTime = (r: { delivery_time: string; promised_delivery_date: string }) =>
      r.delivery_time.slice(0, 10) <= r.promised_delivery_date
    const onTime = rows.filter(isOnTime).length
    const late = rows.filter((r) => !isOnTime(r)).length
    const total = rows.length
    const rate = Math.round((onTime / total) * 100)

    const lateRows = rows.filter((r) => !isOnTime(r))
    const avgDelay = lateRows.length
      ? Math.round(lateRows.reduce((sum, r) => {
          const delivered = new Date(r.delivery_time).setHours(0, 0, 0, 0)
          const promised = new Date(`${r.promised_delivery_date}T00:00:00`).getTime()
          return sum + Math.max(0, Math.round((delivered - promised) / 86_400_000))
        }, 0) / lateRows.length)
      : 0

    return { rate, onTime, late, total, avgDelay }
  }

  const otd = computeOtd(otdData ?? [])

  const receivingTrendMap = new Map<string, { count: number; details: ReceivingDetailForAnalytics[] }>()
  for (const row of receivingTrendRows ?? []) {
    const month = row.posting_date?.slice(0, 7) ?? 'Tanpa tanggal'
    receivingTrendMap.set(month, { count: (receivingTrendMap.get(month)?.count ?? 0) + 1, details: [] })
  }
  const receivingHeaderMonthMap = new Map((receivingTrendRows ?? []).map(row => [String(row.ptr_no ?? '').trim().toUpperCase(), row.posting_date?.slice(0, 7) ?? 'Tanpa tanggal']))
  const receivingDetailsForAnalytics = (receivingDetails ?? []) as (ReceivingDetailForAnalytics & { document_no?: string | null })[]
  for (const detail of receivingDetailsForAnalytics) {
    const month = receivingHeaderMonthMap.get(String(detail.document_no ?? '').trim().toUpperCase())
    if (month && receivingTrendMap.has(month)) receivingTrendMap.get(month)?.details.push(detail)
  }
  const receivingPackagingForAnalytics = (receivingPackaging ?? []) as ReceivingPackaging[]
  const receivingLoad = calculateReceivingLoad(receivingDetailsForAnalytics, receivingPackagingForAnalytics)
  const receivingTrend = [...receivingTrendMap.entries()].slice(-6).map(([month, value]) => ({
    month,
    count: value.count,
    ...(() => {
      const load = calculateReceivingLoad(value.details, receivingPackagingForAnalytics)
      return {
        quantity: load.quantity,
        volumeCbm: load.volumeCbm,
        tonnage: load.tonnage,
        pallets: load.pallets,
      }
    })(),
  }))
  const receivingMonthlyAverage = {
    quantity: receivingTrend.length ? receivingTrend.reduce((sum, point) => sum + point.quantity, 0) / receivingTrend.length : 0,
    volumeCbm: receivingTrend.length ? receivingTrend.reduce((sum, point) => sum + point.volumeCbm, 0) / receivingTrend.length : 0,
    tonnage: receivingTrend.length ? receivingTrend.reduce((sum, point) => sum + point.tonnage, 0) / receivingTrend.length : 0,
    pallets: receivingTrend.length ? receivingTrend.reduce((sum, point) => sum + point.pallets, 0) / receivingTrend.length : 0,
  }
  const receivingLeadTimeGroups = { nij: { count: 0, totalDays: 0 }, other: { count: 0, totalDays: 0 } }
  for (const row of receivingTrendRows ?? []) {
    const days = Number(row.ship_to_posting_days)
    if (!Number.isFinite(days)) continue
    const group = days >= 1 && days <= 3 ? receivingLeadTimeGroups.nij : receivingLeadTimeGroups.other
    group.count += 1
    group.totalDays += days
  }
  const receivingLeadTime = {
    nij: { count: receivingLeadTimeGroups.nij.count, averageDays: receivingLeadTimeGroups.nij.count ? receivingLeadTimeGroups.nij.totalDays / receivingLeadTimeGroups.nij.count : 0 },
    other: { count: receivingLeadTimeGroups.other.count, averageDays: receivingLeadTimeGroups.other.count ? receivingLeadTimeGroups.other.totalDays / receivingLeadTimeGroups.other.count : 0 },
  }
  const receivingFastPtrs = (receivingTrendRows ?? [])
    .filter(row => Number(row.ship_to_posting_days) < 3)
    .map(row => ({ ptrNo: String(row.ptr_no ?? '-'), leadTime: Number(row.ship_to_posting_days) }))
  const receivingLeadTimeAfterFast = (receivingTrendRows ?? [])
    .map(row => Number(row.ship_to_posting_days))
    .filter(days => Number.isFinite(days) && days >= 3)
  const receivingAverageAfterFast = receivingLeadTimeAfterFast.length
    ? receivingLeadTimeAfterFast.reduce((sum, days) => sum + days, 0) / receivingLeadTimeAfterFast.length
    : 0
  const leadTimeTrendMap = new Map<string, { nij: { total: number; count: number }; other: { total: number; count: number } }>()
  for (const row of receivingTrendRows ?? []) {
    const days = Number(row.ship_to_posting_days)
    if (!Number.isFinite(days)) continue
    const month = row.posting_date?.slice(0, 7) ?? 'Tanpa tanggal'
    const point = leadTimeTrendMap.get(month) ?? { nij: { total: 0, count: 0 }, other: { total: 0, count: 0 } }
    const group = days >= 1 && days <= 3 ? point.nij : point.other
    group.total += days
    group.count += 1
    leadTimeTrendMap.set(month, point)
  }
  const leadTimeTrend = [...leadTimeTrendMap.entries()].slice(-6).map(([month, point]) => ({
    month,
    nij: point.nij.count ? point.nij.total / point.nij.count : 0,
    other: point.other.count ? point.other.total / point.other.count : 0,
  }))
  const receivingItemMap = new Map<string, number>()
  for (const detail of receivingDetailsForAnalytics) {
    const item = String(detail.item_no ?? detail.description ?? 'Item tidak diketahui').trim() || 'Item tidak diketahui'
    receivingItemMap.set(item, (receivingItemMap.get(item) ?? 0) + (Number(detail.quantity) || 0))
  }
  const receivingTopItems = [...receivingItemMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  return {
    // SCM Pulse metrics
    scmPulse: {
      shipment: activeShipmentCount ?? 0,
      receiving: receivingCount ?? 0,
      outbound: outboundTotal ?? 0,
      // inventory: inventoryCount ?? 0, // Add when inventory table is available
      inventory: 0, // Placeholder until inventory table is available
      operationalReadiness: otd.rate ?? 0,
    },
    // Area metrics
    areas: [
      {
        n: '01',
        title: 'Strategy & Planning',
        desc: 'Control room untuk roadmap, target layanan, kapasitas, dan prioritas eksekusi SCM.',
        icon: 'Target',
        tone: 'blue',
        metrics: [
          { label: 'Service level', value: 92, unit: '%' },
          { label: 'Capacity plan', value: 18, unit: '' },
          { label: 'Weekly priorities', value: 7, unit: '' },
        ],
      },
      {
        n: '02',
        title: 'Inventory Management',
        desc: 'Pantau stok, movement, slow moving, safety stock, dan sinyal risiko kekurangan barang.',
        icon: 'Boxes',
        tone: 'green',
        metrics: [
          { label: 'Available stock', value: 78, unit: '%' },
          { label: 'Low stock alert', value: 52, unit: '' },
          { label: 'Stock movement', value: 34, unit: '' },
        ],
      },
      {
        n: '03',
        title: 'Procurement',
        desc: 'Kelola kebutuhan pengadaan, supplier lead time, harga, dan pemenuhan PO.',
        icon: 'ClipboardCheck',
        tone: 'orange',
        metrics: [
          { label: 'PR to PO lead time', value: 7, unit: 'hari' },
          { label: 'Supplier SLA', value: 95, unit: '%' },
          { label: 'Cost variance', value: 12, unit: '%' },
        ],
      },
      {
        n: '04',
        title: 'Vendor Management',
        desc: 'Lihat performa vendor, SLA, POD, coverage, rate card, dan issue transport.',
        icon: 'Users',
        tone: 'blue',
        metrics: [
          { label: 'On-time rate', value: vendorCount ?? 0, unit: '' },
          { label: 'POD completion', value: issueCount ?? 0, unit: '' },
          { label: 'Vendor score', value: 92, unit: '' },
        ],
      },
      {
        n: '05',
        title: 'Logistics & Distribution',
        desc: 'Tracking shipment, rute, ETA, delay, status POD, dan pengiriman sampai selesai.',
        icon: 'Truck',
        tone: 'red',
        metrics: [
          { label: 'Shipment status', value: activeShipmentCount ?? 0, unit: '' },
          { label: 'Delay reason', value: lateShipments?.length ?? 0, unit: '' },
          { label: 'Delivery lead time', value: deliveredTodayCount ?? 0, unit: '' },
        ],
      },
      {
        n: '06',
        title: 'Risk Management',
        desc: 'Satu tempat untuk issue log, mitigasi, severity, owner, dan tindak lanjut operasional.',
        icon: 'ShieldAlert',
        tone: 'orange',
        metrics: [
          { label: 'Open issues', value: issueCount ?? 0, unit: '' },
          { label: 'Risk level', value: 12, unit: '' },
          { label: 'Mitigation status', value: 85, unit: '%' },
        ],
      },
      {
        n: '07',
        title: 'Warehouse Management',
        desc: 'Monitor receiving, outbound, checklist gudang, staging, dock, equipment, dan produktivitas.',
        icon: 'Factory',
        tone: 'green',
        metrics: [
          { label: 'Checklist rate', value: 84, unit: '%' },
          { label: 'Inbound flow', value: receivingCount ?? 0, unit: '' },
          { label: 'Outbound readiness', value: dispatchedCount ?? 0, unit: '' },
        ],
      },
    ],
    // Additional data for other sections
    customerCount: customers?.length ?? 0,
    totalMachineHD: (customers as any[]).reduce((s, r) => s + (Number(r.machine_count) || 0), 0),
    locationCoverage: customers?.length ? Math.round(((customers as any[]).filter((r) => r.latitude != null && r.longitude != null).length) * 100 / customers.length) : 0,
    lateShipmentsCount: lateShipments?.length ?? 0,
    receivingAI: {
      trend: receivingTrend,
      load: receivingLoad,
      monthlyAverage: receivingMonthlyAverage,
      leadTime: receivingLeadTime,
      leadTimeTrend,
      fastPtrs: receivingFastPtrs,
      averageAfterFast: receivingAverageAfterFast,
      topItems: receivingTopItems,
    },
  }
}
