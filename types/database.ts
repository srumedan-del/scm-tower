export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type View<Row> = { Row: Row; Relationships: [] }
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] }

export type Database = {
	public: {
		Tables: {
			issue_log: Table<Record<string, unknown>>
			warehouse_checklist: Table<Record<string, unknown>>
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
		}
		Functions: Record<string, never>
	}
}
