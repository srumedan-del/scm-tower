"""
Seed dummy data for SCM Control Tower workflow testing.
Schema sesuai real Supabase columns (introspected via OpenAPI).
"""
import json, subprocess, os
from pathlib import Path

env_path = Path(r"D:/scm-app/scm-tower/.env.local")
env = {}
for line in env_path.read_text(encoding='utf-8').splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()

URL = env['NEXT_PUBLIC_SUPABASE_URL']
KEY = env['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']

def rest(method, path, data=None, prefer='return=minimal'):
    cmd = ['curl', '-s', '-X', method, f"{URL}{path}",
           '-H', f'Authorization: Bearer {KEY}',
           '-H', f'apikey: {KEY}',
           '-H', 'Content-Type: application/json',
           '-H', f'Prefer: {prefer}']
    if data is not None:
        cmd += ['-d', json.dumps(data)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, r.stdout

NOW = '2026-08-30T12:00:00+00:00'

# 1. Shipments (12) — schema real: id integer, required: shipment_no, shipment_date, shipment_type, status, delay_duration_minutes, pod_status, created_at, updated_at
print("=== Inserting shipments ===")
shipments = [
    # Delivered
    {'shipment_no': 'SHP-2026-08-25-001', 'document_no': 'PSS-2026-08-25-001', 'shipment_date': '2026-08-25', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Banda Aceh', 'destination_name': 'RS Siloam Group', 'route': 'MDN-BDA', 'shipment_type': 'COURIER', 'vendor_name': 'ASSA (Anugrah Surya Alam)', 'vehicle_no': 'BK 7001 AA', 'driver_name': 'Suparman', 'status': 'delivered', 'planned_dispatch_time': '2026-08-25T09:00:00', 'actual_dispatch_time': '2026-08-25T09:15:00', 'eta': '2026-08-26', 'actual_arrival_time': '2026-08-26T11:30:00', 'sla_status': 'on_time', 'pod_status': 'received', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    {'shipment_no': 'SHP-2026-08-26-002', 'document_no': 'PSS-2026-08-26-002', 'shipment_date': '2026-08-26', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Pekanbaru', 'destination_name': 'Kimia Farma', 'route': 'MDN-PKU', 'shipment_type': 'COURIER', 'vendor_name': 'ASSA (Anugrah Surya Alam)', 'vehicle_no': 'BK 7002 BB', 'driver_name': 'Bambang', 'status': 'delivered', 'planned_dispatch_time': '2026-08-26T08:00:00', 'actual_dispatch_time': '2026-08-26T08:30:00', 'eta': '2026-08-27', 'actual_arrival_time': '2026-08-27T14:00:00', 'sla_status': 'on_time', 'pod_status': 'received', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    {'shipment_no': 'SHP-2026-08-27-003', 'document_no': 'PSS-2026-08-27-003', 'shipment_date': '2026-08-27', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Banda Aceh', 'destination_name': 'RS Harapan Kita', 'route': 'MDN-BDA', 'shipment_type': 'TRUCKING', 'vendor_name': 'Indah Logistik', 'vehicle_no': 'BK 8001 CC', 'driver_name': 'Hendra', 'status': 'delivered', 'planned_dispatch_time': '2026-08-27T07:00:00', 'actual_dispatch_time': '2026-08-27T07:00:00', 'eta': '2026-08-29', 'actual_arrival_time': '2026-08-29T16:00:00', 'sla_status': 'on_time', 'pod_status': 'received', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    # In transit
    {'shipment_no': 'SHP-2026-08-29-004', 'document_no': 'PSS-2026-08-29-004', 'shipment_date': '2026-08-29', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Siantar', 'destination_name': 'RS Vita Insani', 'route': 'MDN-SNT', 'shipment_type': 'COURIER', 'vendor_name': 'RSA (Riau Surya Abadi)', 'vehicle_no': 'BK 9001 DD', 'driver_name': 'Rudi', 'status': 'in_transit', 'planned_dispatch_time': '2026-08-29T08:00:00', 'actual_dispatch_time': '2026-08-29T08:00:00', 'eta': '2026-08-30', 'sla_status': 'at_risk', 'pod_status': 'pending', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    {'shipment_no': 'SHP-2026-08-29-005', 'document_no': 'PSS-2026-08-29-005', 'shipment_date': '2026-08-29', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Cikupa', 'destination_name': 'PT Mesin Industri', 'route': 'MDN-CKP', 'shipment_type': 'TRUCKING', 'vendor_name': 'PT. RIANG SARANA ARTHA', 'vehicle_no': 'BK 9002 EE', 'driver_name': 'Doni', 'status': 'in_transit', 'planned_dispatch_time': '2026-08-29T06:00:00', 'actual_dispatch_time': '2026-08-29T07:30:00', 'eta': '2026-08-31', 'sla_status': 'late', 'pod_status': 'pending', 'delay_reason': 'Koordinasi dengan Sisca, kapal telat', 'delay_duration_minutes': 480, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    {'shipment_no': 'SHP-2026-08-30-006', 'document_no': 'PSS-2026-08-30-006', 'shipment_date': '2026-08-30', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Banda Aceh', 'destination_name': 'Customer Demo Aceh', 'route': 'MDN-BDA', 'shipment_type': 'COURIER', 'vendor_name': 'ASSA (Anugrah Surya Alam)', 'vehicle_no': 'BK 7003 CC', 'driver_name': 'Eko', 'status': 'in_transit', 'planned_dispatch_time': '2026-08-30T08:00:00', 'actual_dispatch_time': '2026-08-30T08:00:00', 'eta': '2026-08-31', 'sla_status': 'at_risk', 'pod_status': 'pending', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    # Delayed
    {'shipment_no': 'SHP-2026-08-26-007', 'document_no': 'PSS-2026-08-26-007', 'shipment_date': '2026-08-26', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Lhokseumawe', 'destination_name': 'RS Cut Meutia', 'route': 'MDN-LSM', 'shipment_type': 'TRUCKING', 'vendor_name': 'Indah Logistik', 'vehicle_no': 'BK 8002 DD', 'driver_name': 'Wahyu', 'status': 'delayed', 'planned_dispatch_time': '2026-08-26T07:00:00', 'actual_dispatch_time': '2026-08-26T07:00:00', 'eta': '2026-08-28', 'sla_status': 'late', 'pod_status': 'pending', 'delay_reason': 'Cuaca buruk, jalan longsor', 'delay_duration_minutes': 1440, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    {'shipment_no': 'SHP-2026-08-27-008', 'document_no': 'PSS-2026-08-27-008', 'shipment_date': '2026-08-27', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Tebing Tinggi', 'destination_name': 'Customer Farmasi', 'route': 'MDN-TBT', 'shipment_type': 'TRUCKING', 'vendor_name': 'Raja Cepat', 'vehicle_no': 'BK 9003 FF', 'driver_name': 'Galih', 'status': 'delayed', 'planned_dispatch_time': '2026-08-27T07:00:00', 'actual_dispatch_time': '2026-08-27T07:00:00', 'eta': '2026-08-28', 'sla_status': 'late', 'pod_status': 'pending', 'delay_reason': 'Driver istirahat, over time', 'delay_duration_minutes': 600, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    # Loaded / picking
    {'shipment_no': 'SHP-2026-08-30-009', 'document_no': 'PSS-2026-08-30-009', 'shipment_date': '2026-08-30', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Pekanbaru', 'destination_name': 'Apotek Kimia Farma 88', 'route': 'MDN-PKU', 'shipment_type': 'COURIER', 'vendor_name': 'ASSA (Anugrah Surya Alam)', 'vehicle_no': 'BK 7004 DD', 'driver_name': 'Imam', 'status': 'loaded', 'planned_dispatch_time': '2026-08-30T08:00:00', 'eta': '2026-08-31', 'sla_status': 'on_time', 'pod_status': 'pending', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    {'shipment_no': 'SHP-2026-08-30-010', 'document_no': 'PSS-2026-08-30-010', 'shipment_date': '2026-08-30', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Rantauprapat', 'destination_name': 'Customer Rantau', 'route': 'MDN-RTP', 'shipment_type': 'COURIER', 'vendor_name': 'RSA (Riau Surya Abadi)', 'vehicle_no': 'BK 9004 GG', 'driver_name': 'Jaka', 'status': 'picking', 'planned_dispatch_time': '2026-08-30T14:00:00', 'eta': '2026-08-31', 'sla_status': 'on_time', 'pod_status': 'pending', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    # Planned
    {'shipment_no': 'SHP-2026-08-31-011', 'document_no': 'PSS-2026-08-31-011', 'shipment_date': '2026-08-31', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Banda Aceh', 'destination_name': 'RS Zainoel Abidin', 'route': 'MDN-BDA', 'shipment_type': 'TRUCKING', 'vendor_name': 'PT. ADI SARANA ARMADA TBK - MEDAN', 'vehicle_no': 'BK 5001 HH', 'driver_name': 'Karim', 'status': 'planned', 'planned_dispatch_time': '2026-08-31T07:00:00', 'eta': '2026-09-02', 'sla_status': 'on_time', 'pod_status': 'pending', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
    {'shipment_no': 'SHP-2026-08-31-012', 'document_no': 'PSS-2026-08-31-012', 'shipment_date': '2026-08-31', 'origin_warehouse': 'SRU Medan', 'destination_city': 'Pematangsiantar', 'destination_name': 'Customer Siantar', 'route': 'MDN-PMS', 'shipment_type': 'TRUCKING', 'vendor_name': 'Raja Cepat', 'vehicle_no': 'BK 9005 II', 'driver_name': 'Lutfi', 'status': 'planned', 'planned_dispatch_time': '2026-08-31T08:00:00', 'eta': '2026-09-01', 'sla_status': 'on_time', 'pod_status': 'pending', 'delay_duration_minutes': 0, 'created_by': 'Erwin', 'created_at': NOW, 'updated_at': NOW},
]
code, out = rest('POST', '/rest/v1/shipments', shipments, prefer='return=representation')
print(f"  exit={code}, response={out[:200]}")

# 2. Shipment status logs (history for SHP-2026-08-25-001)
# First lookup id of that shipment
code, out = rest('GET', '/rest/v1/shipments?select=id,shipment_no&order=shipment_date', prefer='count=none')
ship_lookup = {s['shipment_no']: s['id'] for s in json.loads(out)} if code == 0 and out else {}
print(f"\n  shipment ids: {ship_lookup}")

print("\n=== Inserting shipment_status_logs ===")
all_logs = []
for sid, no in ship_lookup.items():
    if no == 'SHP-2026-08-25-001':
        all_logs.extend([
            {'shipment_id': sid, 'status_from': None, 'status_to': 'planned', 'updated_by': 'Erwin', 'location': 'SRU Medan', 'notes': 'PSS dibuat dari ERP', 'updated_at': '2026-08-25T08:00:00'},
            {'shipment_id': sid, 'status_from': 'planned', 'status_to': 'picking', 'updated_by': 'Mandras', 'location': 'SRU Medan', 'notes': 'Mulai picking', 'updated_at': '2026-08-25T08:30:00'},
            {'shipment_id': sid, 'status_from': 'picking', 'status_to': 'packed', 'updated_by': 'Mandras', 'location': 'SRU Medan', 'notes': 'Packing selesai 3 box', 'updated_at': '2026-08-25T08:55:00'},
            {'shipment_id': sid, 'status_from': 'packed', 'status_to': 'loaded', 'updated_by': 'Suparman', 'location': 'SRU Medan', 'notes': 'Loaded ke BK 7001 AA', 'updated_at': '2026-08-25T09:15:00'},
            {'shipment_id': sid, 'status_from': 'loaded', 'status_to': 'in_transit', 'updated_by': 'Suparman', 'location': 'Medan - Banda Aceh (km 50)', 'notes': 'Mulai perjalanan', 'updated_at': '2026-08-25T09:30:00'},
            {'shipment_id': sid, 'status_from': 'in_transit', 'status_to': 'delivered', 'updated_by': 'Customer BDA', 'location': 'RS Siloam Banda Aceh', 'notes': 'Diterima Bagian Farmasi, POD received', 'updated_at': '2026-08-26T11:30:00'},
        ])
    elif no == 'SHP-2026-08-29-004':
        all_logs.extend([
            {'shipment_id': sid, 'status_from': None, 'status_to': 'planned', 'updated_by': 'Erwin', 'location': 'SRU Medan', 'notes': 'PSS dibuat', 'updated_at': '2026-08-29T07:30:00'},
            {'shipment_id': sid, 'status_from': 'planned', 'status_to': 'picking', 'updated_by': 'Mandras', 'location': 'SRU Medan', 'notes': 'Picking selesai', 'updated_at': '2026-08-29T07:45:00'},
            {'shipment_id': sid, 'status_from': 'picking', 'status_to': 'packed', 'updated_by': 'Mandras', 'location': 'SRU Medan', 'notes': 'Packed 1 box', 'updated_at': '2026-08-29T07:55:00'},
            {'shipment_id': sid, 'status_from': 'packed', 'status_to': 'loaded', 'updated_by': 'Rudi', 'location': 'SRU Medan', 'notes': 'Loaded ke BK 9001 DD', 'updated_at': '2026-08-29T08:00:00'},
            {'shipment_id': sid, 'status_from': 'loaded', 'status_to': 'in_transit', 'updated_by': 'Rudi', 'location': 'Medan - Siantar', 'notes': 'Berangkat, ETA besok', 'updated_at': '2026-08-29T08:05:00'},
        ])

code, out = rest('POST', '/rest/v1/shipment_status_logs', all_logs)
print(f"  exit={code}, response={out[:200]}")

# 3. Receiving (no 'status' column — schema different)
print("\n=== Inserting receiving_header ===")
receiving = [
    {'ptr_no': 'PTR-2026-08-25-001', 'transfer_order_no': 'TR-2026-08-25-001', 'transfer_from_code': 'JKT-JP12', 'transfer_to_code': 'SRU-MDN', 'posting_date': '2026-08-25', 'shipment_date': '2026-08-20', 'receipt_date': '2026-08-25', 'shipping_agent_code': 'ASSA', 'ship_to_receipt_days': 5, 'receipt_to_posting_days': 0, 'ship_to_posting_days': 5, 'source_file': 'rcv2026-08-25.csv', 'import_period': '2026-08', 'created_at': NOW, 'updated_at': NOW},
    {'ptr_no': 'PTR-2026-08-27-002', 'transfer_order_no': 'TR-2026-08-27-002', 'transfer_from_code': 'JKT-JP12', 'transfer_to_code': 'SRU-MDN', 'posting_date': '2026-08-27', 'shipment_date': '2026-08-22', 'receipt_date': '2026-08-27', 'shipping_agent_code': 'RSA', 'ship_to_receipt_days': 5, 'receipt_to_posting_days': 0, 'ship_to_posting_days': 5, 'source_file': 'rcv2026-08-27.csv', 'import_period': '2026-08', 'created_at': NOW, 'updated_at': NOW},
    {'ptr_no': 'PTR-2026-08-28-003', 'transfer_order_no': 'TR-2026-08-28-003', 'transfer_from_code': 'MDN-CAR', 'transfer_to_code': 'SRU-MDN', 'posting_date': '2026-08-28', 'shipment_date': '2026-08-28', 'receipt_date': '2026-08-28', 'shipping_agent_code': 'INTERNAL', 'ship_to_receipt_days': 0, 'receipt_to_posting_days': 0, 'ship_to_posting_days': 0, 'source_file': 'rcv2026-08-28.csv', 'import_period': '2026-08', 'created_at': NOW, 'updated_at': NOW},
    {'ptr_no': 'PTR-2026-08-29-004', 'transfer_order_no': 'TR-2026-08-29-004', 'transfer_from_code': 'JKT-CKPA', 'transfer_to_code': 'SRU-MDN', 'posting_date': '2026-08-29', 'shipment_date': '2026-08-11', 'receipt_date': '2026-08-29', 'shipping_agent_code': 'INDAH', 'ship_to_receipt_days': 18, 'receipt_to_posting_days': 0, 'ship_to_posting_days': 18, 'source_file': 'rcv2026-08-29.csv', 'import_period': '2026-08', 'created_at': NOW, 'updated_at': NOW},
]
code, out = rest('POST', '/rest/v1/receiving_header', receiving, prefer='return=representation')
print(f"  exit={code}, response={out[:200]}")

# 4. Issue log (no 'severity', has 'description', 'probability', 'owner_id', 'mitigation_plan', 'closed_at')
print("\n=== Inserting issue_log ===")
issues = [
    {'issue_no': 'ISS-2026-001', 'issue_date': '2026-08-20', 'category': 'Vendor', 'title': 'Delay shipment Banda Aceh karena cuaca', 'description': 'Hujan deras + jalan longsor di Aceh Tengah', 'impact': 'Customer complain RS Siloam', 'probability': 'medium', 'status': 'resolved', 'owner_id': 'Erwin', 'mitigation_plan': 'Update ETA real-time ke customer', 'due_date': '2026-08-25', 'closed_at': '2026-08-26T10:00:00', 'created_at': NOW, 'updated_at': NOW},
    {'issue_no': 'ISS-2026-002', 'issue_date': '2026-08-22', 'category': 'Receiving', 'title': 'Lead time JKT-CKPA tinggi (19 hari)', 'description': 'Lead time rata-rata dari supplier JKT-CKPA tinggi', 'impact': 'Stok menipis, butuh safety stock naik', 'probability': 'high', 'status': 'in_progress', 'owner_id': 'Erwin', 'mitigation_plan': 'Koordinasi dengan planner, naikkan safety stock 20%', 'due_date': '2026-08-30', 'created_at': NOW, 'updated_at': NOW},
    {'issue_no': 'ISS-2026-003', 'issue_date': '2026-08-25', 'category': 'Warehouse', 'title': 'Pallet rusak di receiving area', 'description': 'Pallet kayu lapuk di area receiving', 'impact': '3 box harus pindah pallet, delay 1 jam', 'probability': 'low', 'status': 'resolved', 'owner_id': 'Mandras', 'mitigation_plan': 'Inspeksi pallet harian', 'due_date': '2026-08-26', 'closed_at': '2026-08-26T14:00:00', 'created_at': NOW, 'updated_at': NOW},
    {'issue_no': 'ISS-2026-004', 'category': 'Vendor', 'title': 'PSS ke Cikupa belum ada vendor', 'description': 'Belum ada vendor yang confirm untuk shipment ke Cikupa', 'impact': 'Menunggu konfirmasi Sisca', 'probability': 'medium', 'status': 'in_progress', 'owner_id': 'Erwin', 'due_date': '2026-08-30', 'created_at': NOW, 'updated_at': NOW},
    {'issue_no': 'ISS-2026-005', 'category': 'Vendor', 'title': 'Raja Cepat onboarding butuh NDA', 'description': 'Kontrak dan NDA harus ditandatangani sebelum shipment pertama', 'impact': 'Belum bisa terima shipment dari mereka', 'probability': 'medium', 'status': 'open', 'owner_id': 'Erwin', 'due_date': '2026-09-05', 'created_at': NOW, 'updated_at': NOW},
]
code, out = rest('POST', '/rest/v1/issue_log', issues, prefer='return=representation')
print(f"  exit={code}, response={out[:200]}")

# 5. Warehouse checklist — required booleans
print("\n=== Inserting warehouse_checklist ===")
def cl(date_, wh, shift, items, rate, notes, by):
    # items is dict of bool fields
    base = {'checklist_date': date_, 'warehouse_code': wh, 'shift': shift, 'completion_rate': rate, 'issue_notes': notes, 'checked_by': by, 'created_at': NOW, 'updated_at': NOW}
    base.update(items)
    return base

checklists = [
    cl('2026-08-25', 'SRU-MDN', 'Pagi', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': True, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': False, 'safety_check_done': True}, 95, 'Staging outbound belum, 1 box di lantai', 'Mandras'),
    cl('2026-08-26', 'SRU-MDN', 'Pagi', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': True, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': True, 'safety_check_done': True}, 100, 'Semua selesai tepat waktu', 'Mandras'),
    cl('2026-08-27', 'SRU-MDN', 'Pagi', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': False, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': True, 'safety_check_done': False}, 90, 'Stok pallet menipis, safety check belum lengkap', 'Mandras'),
    cl('2026-08-28', 'SRU-MDN', 'Siang', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': True, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': True, 'safety_check_done': True}, 100, 'Shift siang aman', 'Lina'),
]
code, out = rest('POST', '/rest/v1/warehouse_checklist', checklists, prefer='return=representation')
print(f"  exit={code}, response={out[:200]}")

# Final counts
print("\n=== Final counts ===")
for table in ['vendors', 'shipments', 'shipment_status_logs', 'receiving_header', 'issue_log', 'warehouse_checklist']:
    code, out = rest('GET', f'/rest/v1/{table}?select=id', prefer='count=exact')
    try:
        d = json.loads(out)
        print(f"  {table}: {len(d)}")
    except:
        print(f"  {table}: error parsing ({out[:100]})")