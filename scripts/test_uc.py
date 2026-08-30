"""
Final approach: introspect actual check constraints from information_schema via REST.
PostgREST exposes tables but not pg_catalog directly. We'll use the OpenAPI definitions
to figure out what's allowed.

Alternative: use a simple insert with EXACTLY what's needed and check status.
"""
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

# Approach: check if there's an RPC to introspect constraints
r = subprocess.run(['curl','-s',f'{URL}/rest/v1/rpc/get_table_constraints',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}',
    '-H','Content-Type: application/json',
    '-d',json.dumps({'table_name': 'shipments'})], capture_output=True, text=True)
print('RPC test:', r.stdout[:300])
print()

# Last resort: try inserting with all values UPPERCASE / different casing
for v in ['PENDING', 'RECEIVED', 'MISSING', 'NOT_RECEIVED', 'NONE', 'OPEN', 'CLOSED']:
    payload = json.dumps({'shipment_no': f'UC-{v}', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': v, 'delay_duration_minutes': 0})
    r = subprocess.run(['curl','-s','-X','POST',f'{URL}/rest/v1/shipments',
        '-H',f'Authorization: Bearer {KEY}',
        '-H',f'apikey: {KEY}',
        '-H','Content-Type: application/json',
        '-H','Prefer: count=minimal',
        '-d',payload], capture_output=True, text=True)
    try:
        j = json.loads(r.stdout)
        if not j.get('code'):
            print(f'  ACCEPTED: {v!r}')
    except:
        pass

# cleanup
subprocess.run(['curl','-s','-X','DELETE',f'{URL}/rest/v1/shipments?shipment_no=like.UC-%',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}'], capture_output=True, text=True)
print('done')