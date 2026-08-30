export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type View<Row> = { Row: Row; Relationships: [] }
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }

export type Database = {
	public: {
		Tables: {
			issue_log: Table<Record<string, unknown>>
			warehouse_checklist: Table<Record<string, unknown>>

			// SCM Control Tower — schema asli dari Supabase project
			vendors: Table<{
				id: number
				vendor_code: string
				vendor_name: string
				vendor_type: string | null
				pic_name: string | null
				phone: string | null
				email: string | null
				coverage_area: string | null
				default_sla: number | null
				is_active: boolean | null
				created_at: string | null
			}>
			shipments: Table<{
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
				planned_dispatch_time: string | null
				actual_dispatch_time: string | null
				eta: string | null
				actual_arrival_time: string | null
				sla_target_time: string | null
				sla_status: string | null
				delay_reason: string | null
				delay_duration_minutes: number | null
				pod_status: string | null
				notes: string | null
				created_by: string | null
				created_at: string | null
				updated_at: string | null
			}>
			receiving_header: Table<Record<string, unknown>>
			outbound_detail: Table<Record<string, unknown>>
			shipment_status_logs: Table<Record<string, unknown>>
			routes: Table<{
			id: number
			route_code: string
			origin: string
			destination: string
			city: string | null
			standard_lead_time_hours: number | null
			default_vendor_id: number | null
			risk_level: string
			notes: string | null
			created_at: string
		}>
			warehouses: Table<{
			id: number
			warehouse_code: string
			warehouse_name: string
			city: string | null
			address: string | null
			is_active: boolean
			created_at: string
		}>
			master_sku: Table<{
			id: number
			sku_code: string
			item_name: string
			category: string | null
			uom: string
			safety_stock: number | null
			is_active: boolean
			group: string | null
			created_at: string
			updated_at: string
		}>
			customers: Table<Record<string, unknown>>
			transport_fleet: Table<Record<string, unknown>>
			transport_rate_card: Table<Record<string, unknown>>
			v_transport_rate_card: View<Record<string, unknown>>
		}
		Views: {
			vw_daily_scm_summary: View<{
				shipments_today: number | null
				delayed_shipments: number | null
				receiving_today: number | null
				outbound_today: number | null
				low_stock_items: number | null
				open_issues: number | null
			}>
			vw_shipment_kpi: View<{
				on_time_delivery_pct: number | null
				pending_pod: number | null
			}>
			vw_inventory_alert: View<Record<string, unknown>>
			vw_receiving_kpi: View<Record<string, unknown>>
		}
		Functions: Record<string, never>
	}
}