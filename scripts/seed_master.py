"""Insert routes & master_sku dummy data."""
import json, subprocess
from pathlib import Path
env_path = Path(r"D:/scm-app/scm-tower/.env.local")
env = {}
for line in env_path.read_text().splitlines():
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

NOW = '2026-08-30T00:00:00+00:00'

# Routes (12 dummy covering mainlanes)
print("=== Inserting routes ===")
routes = [
    {'route_code': 'MDN-BDA-STD', 'origin': 'SRU Medan', 'destination': 'Banda Aceh', 'city': 'Banda Aceh', 'standard_lead_time_hours': 48, 'risk_level': 'medium', 'notes': 'Mainline Medan-Banda Aceh via Brastagi-Tapak Tuan'},
    {'route_code': 'MDN-PKU-STD', 'origin': 'SRU Medan', 'destination': 'Pekanbaru', 'city': 'Pekanbaru', 'standard_lead_time_hours': 72, 'risk_level': 'medium', 'notes': 'Medan-Pekanbaru via Dumai'},
    {'route_code': 'MDN-SNT-STD', 'origin': 'SRU Medan', 'destination': 'Pematangsiantar', 'city': 'Pematangsiantar', 'standard_lead_time_hours': 24, 'risk_level': 'low', 'notes': 'Short haul, via Tebing Tinggi'},
    {'route_code': 'MDN-TBT-STD', 'origin': 'SRU Medan', 'destination': 'Tebing Tinggi', 'city': 'Tebing Tinggi', 'standard_lead_time_hours': 12, 'risk_level': 'low', 'notes': 'Local area'},
    {'route_code': 'MDN-LSM-STD', 'origin': 'SRU Medan', 'destination': 'Lhokseumawe', 'city': 'Lhokseumawe', 'standard_lead_time_hours': 60, 'risk_level': 'high', 'notes': 'Long route + Aceh Utara'},
    {'route_code': 'MDN-RTP-STD', 'origin': 'SRU Medan', 'destination': 'Rantauprapat', 'city': 'Rantauprapat', 'standard_lead_time_hours': 36, 'risk_level': 'medium', 'notes': 'Via Kisaran'},
    {'route_code': 'MDN-CKP-STD', 'origin': 'SRU Medan', 'destination': 'Cikupa', 'city': 'Cikupa', 'standard_lead_time_hours': 120, 'risk_level': 'high', 'notes': 'Intercity via kapal ferry + truck'},
    {'route_code': 'MDN-PMS-STD', 'origin': 'SRU Medan', 'destination': 'Pematangsiantar', 'city': 'Pematangsiantar', 'standard_lead_time_hours': 24, 'risk_level': 'low', 'notes': 'Same as MDN-SNT alias'},
    {'route_code': 'MDN-LOCAL', 'origin': 'SRU Medan', 'destination': 'Medan Area', 'city': 'Medan', 'standard_lead_time_hours': 6, 'risk_level': 'low', 'notes': 'Internal same-day delivery'},
    {'route_code': 'MDN-BINJAI', 'origin': 'SRU Medan', 'destination': 'Binjai', 'city': 'Binjai', 'standard_lead_time_hours': 4, 'risk_level': 'low', 'notes': 'Very short haul'},
    {'route_code': 'MDN-PADANG', 'origin': 'SRU Medan', 'destination': 'Padang', 'city': 'Padang', 'standard_lead_time_hours': 96, 'risk_level': 'high', 'notes': 'West coast, via Sibolga'},
    {'route_code': 'MDN-JKT', 'origin': 'SRU Medan', 'destination': 'Jakarta', 'city': 'Jakarta', 'standard_lead_time_hours': 144, 'risk_level': 'medium', 'notes': 'Long haul via kapal'},
]
code, out = rest('POST', '/rest/v1/routes', routes)
print(f"  exit={code}, response={out[:300]}")

# Master SKU (10 dummy)
print("\n=== Inserting master_sku ===")
skus = [
    {'sku_code': 'MED-001', 'item_name': 'Amoxicillin 500mg kapsul', 'category': 'Antibiotik', 'uom': 'box', 'safety_stock': 100},
    {'sku_code': 'MED-002', 'item_name': 'Paracetamol 500mg tablet', 'category': 'Analgesik', 'uom': 'box', 'safety_stock': 200},
    {'sku_code': 'MED-003', 'item_name': 'Cefadroxil 500mg kapsul', 'category': 'Antibiotik', 'uom': 'box', 'safety_stock': 80},
    {'sku_code': 'MED-004', 'item_name': 'Ibuprofen 400mg tablet', 'category': 'Analgesik', 'uom': 'box', 'safety_stock': 150},
    {'sku_code': 'MED-005', 'item_name': 'Omeprazole 20mg kapsul', 'category': 'Gastro', 'uom': 'box', 'safety_stock': 120},
    {'sku_code': 'MED-006', 'item_name': 'Metformin 500mg tablet', 'category': 'Antidiabetes', 'uom': 'box', 'safety_stock': 90},
    {'sku_code': 'MED-007', 'item_name': 'Amlodipine 5mg tablet', 'category': 'Cardiovaskular', 'uom': 'box', 'safety_stock': 110},
    {'sku_code': 'MED-008', 'item_name': 'Cetirizine 10mg tablet', 'category': 'Antihistamin', 'uom': 'box', 'safety_stock': 70},
    {'sku_code': 'MED-009', 'item_name': 'Salbutamol 4mg tablet', 'category': 'Respirasi', 'uom': 'box', 'safety_stock': 60},
    {'sku_code': 'MED-010', 'item_name': 'Dexamethasone 0.5mg tablet', 'category': 'Hormon', 'uom': 'box', 'safety_stock': 50},
]
code, out = rest('POST', '/rest/v1/master_sku', skus)
print(f"  exit={code}, response={out[:300]}")

# Counts
print("\n=== Final counts ===")
for table in ['routes', 'warehouses', 'master_sku']:
    code, out = rest('GET', f'/rest/v1/{table}?select=id', prefer='count=exact')
    try:
        print(f"  {table}: {len(json.loads(out))}")
    except:
        print(f"  {table}: error")