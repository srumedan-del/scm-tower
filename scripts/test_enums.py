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

def test(name, payload):
    r = subprocess.run(['curl', '-s', '-X', 'POST', f'{URL}/rest/v1/shipments',
        '-H', f'Authorization: Bearer {KEY}',
        '-H', f'apikey: {KEY}',
        '-H', 'Content-Type: application/json',
        '-H', 'Prefer: count=minimal',
        '-d', json.dumps(payload)], capture_output=True, text=True)
    code = json.loads(r.stdout).get('code', 'OK') if r.stdout else 'no response'
    print(f"  {name}: {code}")

# Test combinations for shipment
print("=== TEST: pod_status values ===")
for v in ['pending','received','delivered','missing','open','closed']:
    test(f'pod={v}', {'shipment_no': f'TEST-POD-{v}-X', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': v, 'delay_duration_minutes': 0, 'created_at': '2026-08-30T00:00:00', 'updated_at': '2026-08-30T00:00:00'})

print("\n=== TEST: status values ===")
for v in ['planned','picking','packed','loaded','in_transit','delivered','delayed','returned','cancelled']:
    test(f'status={v}', {'shipment_no': f'TEST-STATUS-{v}-X', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': v, 'pod_status': 'pending', 'delay_duration_minutes': 0, 'created_at': '2026-08-30T00:00:00', 'updated_at': '2026-08-30T00:00:00'})

print("\n=== TEST: sla_status values ===")
for v in ['on_time','late','at_risk','pending','met','breached']:
    test(f'sla={v}', {'shipment_no': f'TEST-SLA-{v}-X', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': 'pending', 'sla_status': v, 'delay_duration_minutes': 0, 'created_at': '2026-08-30T00:00:00', 'updated_at': '2026-08-30T00:00:00'})

# Clean up test rows
print("\n=== Cleanup ===")
r = subprocess.run(['curl','-s','-X','DELETE',f'{URL}/rest/v1/shipments?shipment_no=like.TEST-*',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}'], capture_output=True, text=True)
print(f"  delete response: {r.stdout[:200]}")