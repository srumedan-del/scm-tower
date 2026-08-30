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

# Maybe lowercase/specific values. Try standard ship terms
candidates = [
    'pending','received','delivered','missing','not_received','completed','incomplete',
    'awaiting','signed','unsigned','collected','not_collected','available','returned',
    'partial','full','verified','unverified','sent','uploaded','not_uploaded',
    'sent_to_customer','returned_to_sender','cleared','pending_verification',
    'on_hold','rejected','accepted','in_transit','pod_received','pod_missing',
    'pod_pending','pod_uploaded','pod_verified','pod_rejected','not_started',
    'incomplete_pod','partial_pod','cleared_with_pod','cleared_without_pod',
    'pending_collection','collected_with_signature','collected_without_signature'
]
for v in candidates:
    payload = json.dumps({'shipment_no': f'POD-{abs(hash(v))}', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': v, 'delay_duration_minutes': 0})
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
        if not r.stdout.strip():
            print(f'  ACCEPTED (empty): {v!r}')

# Cleanup
subprocess.run(['curl','-s','-X','DELETE',f'{URL}/rest/v1/shipments?shipment_no=like.POD-%',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}'], capture_output=True, text=True)
print('done')