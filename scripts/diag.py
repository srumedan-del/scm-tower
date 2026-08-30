import os, subprocess, json
from pathlib import Path
env_path = Path(r"D:/scm-app/scm-tower/.env.local")
env = {}
for line in env_path.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
URL = env['NEXT_PUBLIC_SUPABASE_URL']
KEY = env['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']

# Try minimal payload
payload = {'shipment_no': 'DIAG-MIN', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': 'pending', 'delay_duration_minutes': 0}
r = subprocess.run(['curl','-s','-X','POST',f'{URL}/rest/v1/shipments',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}',
    '-H','Content-Type: application/json',
    '-H','Prefer: return=representation',
    '-d',json.dumps(payload)], capture_output=True, text=True)
print(f'Minimal payload response:')
print(r.stdout[:500])
print()

# With ONLY required fields (no created_at/updated_at — let DB defaults fill)
payload2 = {'shipment_no': 'DIAG-MIN2', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': 'pending', 'delay_duration_minutes': 0}
r = subprocess.run(['curl','-s','-X','POST',f'{URL}/rest/v1/shipments',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}',
    '-H','Content-Type: application/json',
    '-H','Prefer: return=representation',
    '-d',json.dumps(payload2)], capture_output=True, text=True)
print(f'No timestamps payload:')
print(r.stdout[:500])