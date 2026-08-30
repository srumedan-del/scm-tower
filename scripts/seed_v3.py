"""
Final seed: issue_log and warehouse_checklist, dropping owner/checked_by FK refs
(skip FK fields since we don't have profile UUIDs to assign).
"""
import json, subprocess
from pathlib import Path
env_path = Path(r"D:/scm-app/scm-tower/.env.local")
env = {}
for line in env_path.read_text(encoding='utf-8').splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
URL = env['NEXT_PUBLIC_SUPABASE_URL']
KEY = env['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']

def rest(method, path, data=None, prefer='return=representation'):
    cmd = ['curl', '-s', '-X', method, f"{URL}{path}",
           '-H', f'Authorization: Bearer {KEY}',
           '-H', f'apikey: {KEY}',
           '-H', 'Content-Type: application/json',
           '-H', f'Prefer: {prefer}']
    if data is not None:
        cmd += ['-d', json.dumps(data)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.returncode, r.stdout

# Issue log — drop owner_id FK (let it be null)
print("=== Inserting issue_log (without owner_id) ===")
issues = [
    {'issue_no': 'ISS-2026-001', 'issue_date': '2026-08-20', 'category': 'Vendor', 'title': 'Delay shipment Banda Aceh karena cuaca', 'description': 'Hujan deras + jalan longsor di Aceh Tengah', 'impact': 'Customer complain RS Siloam', 'probability': 'medium', 'status': 'resolved', 'mitigation_plan': 'Update ETA real-time ke customer', 'due_date': '2026-08-25', 'closed_at': '2026-08-26T10:00:00'},
    {'issue_no': 'ISS-2026-002', 'issue_date': '2026-08-22', 'category': 'Receiving', 'title': 'Lead time JKT-CKPA tinggi (19 hari)', 'description': 'Lead time rata-rata dari supplier JKT-CKPA tinggi', 'impact': 'Stok menipis, butuh safety stock naik', 'probability': 'high', 'status': 'in_progress', 'mitigation_plan': 'Koordinasi dengan planner, naikkan safety stock 20%', 'due_date': '2026-08-30'},
    {'issue_no': 'ISS-2026-003', 'issue_date': '2026-08-25', 'category': 'Warehouse', 'title': 'Pallet rusak di receiving area', 'description': 'Pallet kayu lapuk di area receiving', 'impact': '3 box harus pindah pallet, delay 1 jam', 'probability': 'low', 'status': 'resolved', 'mitigation_plan': 'Inspeksi pallet harian', 'due_date': '2026-08-26', 'closed_at': '2026-08-26T14:00:00'},
    {'issue_no': 'ISS-2026-004', 'category': 'Vendor', 'title': 'PSS ke Cikupa belum ada vendor', 'description': 'Belum ada vendor yang confirm untuk shipment ke Cikupa', 'impact': 'Menunggu konfirmasi Sisca', 'probability': 'medium', 'status': 'in_progress', 'due_date': '2026-08-30'},
    {'issue_no': 'ISS-2026-005', 'category': 'Vendor', 'title': 'Raja Cepat onboarding butuh NDA', 'description': 'Kontrak dan NDA harus ditandatangani sebelum shipment pertama', 'impact': 'Belum bisa terima shipment dari mereka', 'probability': 'medium', 'status': 'open', 'due_date': '2026-09-05'},
]
code, out = rest('POST', '/rest/v1/issue_log', issues)
print(f"  exit={code}, response={out[:300]}")

# Warehouse checklist — drop checked_by FK
print("\n=== Inserting warehouse_checklist (without checked_by) ===")
def cl(date_, wh, shift, items, notes):
    base = {'checklist_date': date_, 'warehouse_code': wh, 'shift': shift, 'issue_notes': notes}
    base.update(items)
    return base

checklists = [
    cl('2026-08-25', 'SRU-MDN', 'Pagi', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': True, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': False, 'safety_check_done': True}, 'Staging outbound belum, 1 box di lantai'),
    cl('2026-08-26', 'SRU-MDN', 'Pagi', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': True, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': True, 'safety_check_done': True}, 'Semua selesai tepat waktu'),
    cl('2026-08-27', 'SRU-MDN', 'Pagi', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': False, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': True, 'safety_check_done': False}, 'Stok pallet menipis, safety check belum lengkap'),
    cl('2026-08-28', 'SRU-MDN', 'Siang', {'area_receiving_clean': True, 'dock_available': True, 'forklift_ready': True, 'pallet_available': True, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': True, 'safety_check_done': True}, 'Shift siang aman'),
    cl('2026-08-29', 'SRU-MDN', 'Pagi', {'area_receiving_clean': True, 'dock_available': False, 'forklift_ready': True, 'pallet_available': True, 'damaged_goods_separated': True, 'inbound_documents_complete': True, 'outbound_staging_done': True, 'safety_check_done': True}, '1 dock rusak, butuh repair'),
]
code, out = rest('POST', '/rest/v1/warehouse_checklist', checklists)
print(f"  exit={code}, response={out[:300]}")

print("\n=== Final counts ===")
for table in ['vendors', 'issue_log', 'warehouse_checklist', 'receiving_header']:
    code, out = rest('GET', f'/rest/v1/{table}?select=id', prefer='count=exact')
    try:
        d = json.loads(out)
        print(f"  {table}: {len(d)}")
    except:
        print(f"  {table}: parse error")