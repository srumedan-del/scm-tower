-- Migration v60: perawatan keamanan dan performa (hasil Supabase Advisor, 19 Nov 2026)
-- Aman dijalankan ulang. Tidak mengubah data, hanya hak akses, pengaturan fungsi, policy, dan index.

begin;

-- 1. KEAMANAN: create_trip_from_shipments (SECURITY DEFINER) bisa dipanggil publik lewat
--    /rest/v1/rpc. Aplikasi memanggilnya dari server dengan service role, jadi cabut akses publik.
revoke execute on function public.create_trip_from_shipments(bigint, bigint[], uuid, bigint, bigint, bigint, bigint, text)
  from public, anon, authenticated;
grant execute on function public.create_trip_from_shipments(bigint, bigint[], uuid, bigint, bigint, bigint, bigint, text)
  to service_role;

-- 2. KEAMANAN: kunci search_path fungsi agar tidak bisa dibelokkan ke objek di schema lain.
alter function public.bulk_insert_outbound_detail(jsonb) set search_path = public, extensions, pg_temp;
alter function public.bulk_update_outbound_detail_created_times(jsonb) set search_path = public, extensions, pg_temp;
alter function public.bulk_update_outbound_detail_document_links(jsonb) set search_path = public, extensions, pg_temp;
alter function public.bulk_update_outbound_header_created_times(jsonb) set search_path = public, extensions, pg_temp;
alter function public.calc_budget_request() set search_path = public, extensions, pg_temp;
alter function public.calc_hd_monitoring() set search_path = public, extensions, pg_temp;
alter function public.calc_shipment_biaya() set search_path = public, extensions, pg_temp;
alter function public.create_trip_from_shipments(bigint, bigint[], uuid, bigint, bigint, bigint, bigint, text) set search_path = public, extensions, pg_temp;
alter function public.enforce_crossdocking_lk() set search_path = public, extensions, pg_temp;
alter function public.enforce_retail_resi_in_transit() set search_path = public, extensions, pg_temp;
alter function public.import_receiving_detail(text, text) set search_path = public, extensions, pg_temp;
alter function public.parse_date_id(text) set search_path = public, extensions, pg_temp;
alter function public.parse_num_id(text) set search_path = public, extensions, pg_temp;
alter function public.parse_ts_id(text) set search_path = public, extensions, pg_temp;
alter function public.prevent_duplicate_route() set search_path = public, extensions, pg_temp;
alter function public.refresh_outbound_header_has_detail() set search_path = public, extensions, pg_temp;
alter function public.set_customers_updated_at() set search_path = public, extensions, pg_temp;
alter function public.set_updated_at() set search_path = public, extensions, pg_temp;
alter function public.sync_crossdocking_customer() set search_path = public, extensions, pg_temp;

-- 3. PERFORMA: policy RLS memanggil auth.jwt() sekali per query, bukan per baris.
--    Isi aturannya sama persis, hanya dibungkus (select ...).
alter policy admin_all_outbound_detail on public.outbound_detail
  using (((select auth.jwt()) ->> 'role') = 'admin')
  with check (((select auth.jwt()) ->> 'role') = 'admin');
alter policy operator_select_outbound_detail on public.outbound_detail
  using (((select auth.jwt()) ->> 'role') = any (array['admin', 'operator']));

alter policy admin_all_outbound_header on public.outbound_header
  using (((select auth.jwt()) ->> 'role') = 'admin')
  with check (((select auth.jwt()) ->> 'role') = 'admin');
alter policy operator_select_outbound_header on public.outbound_header
  using (((select auth.jwt()) ->> 'role') = any (array['admin', 'operator']));

alter policy admin_all_shipment_tracking on public.shipment_tracking_legacy
  using (((select auth.jwt()) ->> 'role') = 'admin')
  with check (((select auth.jwt()) ->> 'role') = 'admin');

alter policy admin_all_vehicles on public.vehicles
  using (((select auth.jwt()) ->> 'role') = 'admin')
  with check (((select auth.jwt()) ->> 'role') = 'admin');
alter policy viewer_select_vehicles on public.vehicles
  using (((select auth.jwt()) ->> 'role') = any (array['admin', 'operator', 'viewer']));

alter policy admin_all_vendors on public.vendors
  using (((select auth.jwt()) ->> 'role') = 'admin')
  with check (((select auth.jwt()) ->> 'role') = 'admin');
alter policy viewer_select_vendors on public.vendors
  using (((select auth.jwt()) ->> 'role') = any (array['admin', 'operator', 'viewer']));

-- 4. PERFORMA: hapus index ganda (idx_transport_rate_card_vendor_id identik dengan ini).
drop index if exists public.idx_trc_vendor;

-- 5. PERFORMA: index untuk foreign key di tabel yang aktif dipakai.
create index if not exists outbound_detail_outbound_header_id_idx on public.outbound_detail (outbound_header_id);
create index if not exists shipment_tracking_crossdocking_id_idx on public.shipment_tracking (crossdocking_id);
create index if not exists shipment_tracking_driver_id_idx on public.shipment_tracking (driver_id);
create index if not exists shipment_tracking_helper_id_idx on public.shipment_tracking (helper_id);
create index if not exists shipment_tracking_route_id_idx on public.shipment_tracking (route_id);
create index if not exists shipment_tracking_transporter_id_idx on public.shipment_tracking (transporter_id);
create index if not exists shipment_tracking_vehicle_id_idx on public.shipment_tracking (vehicle_id);
create index if not exists trip_driver_id_idx on public.trip (driver_id);
create index if not exists trip_helper_id_idx on public.trip (helper_id);
create index if not exists trip_route_id_idx on public.trip (route_id);
create index if not exists trip_vehicle_id_idx on public.trip (vehicle_id);
create index if not exists trip_stop_crossdocking_id_idx on public.trip_stop (crossdocking_id);
create index if not exists trip_stop_pod_id_idx on public.trip_stop (pod_id);
create index if not exists driver_location_logs_driver_id_idx on public.driver_location_logs (driver_id);
create index if not exists trip_fuel_logs_driver_id_idx on public.trip_fuel_logs (driver_id);
create index if not exists shipment_event_log_shipment_tracking_id_idx on public.shipment_event_log (shipment_tracking_id);
create index if not exists crossdocking_pts_crossdocking_id_idx on public.crossdocking_pts (crossdocking_id);
create index if not exists crossdocking_header_customer_code_idx on public.crossdocking_header (customer_code);

commit;
