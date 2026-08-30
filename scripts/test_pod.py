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

# Brute force test for pod_status values
candidates = [
    'no_pod','awaiting_pod','N/A','OPEN','CLOSED','PENDING','RECEIVED','open','not_received','unreceived',
    'received_late','unclear','POD_PENDING','POD_RECEIVED','POD_MISSING','POD_OK','empty','none','-',
    'not_yet','not_applicable','N/A','available','unavailable','in_progress','done','cancelled',
    'Y','N','T','F','true','false','1','0','wait','not_available','received_complete',
    'sudah','belum','not_received_yet','done_pod','no','yes',
    'POD','OPEN_POD','CLOSE_POD','received_ok','received_signed','signed',
    'delivered_no_pod','delivered_with_pod','signed_pod'
]
print(f'Testing {len(candidates)} pod_status candidates...')
accepted = []
for v in candidates:
    payload = json.dumps({'shipment_no': f'DIAG-POD-{abs(hash(v))}', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': v, 'delay_duration_minutes': 0, 'created_at': '2026-08-30T00:00:00', 'updated_at': '2026-08-30T00:00:00'})
    r = subprocess.run(['curl','-s','-X','POST',f'{URL}/rest/v1/shipments',
        '-H',f'Authorization: Bearer {KEY}',
        '-H',f'apikey: {KEY}',
        '-H','Content-Type: application/json',
        '-H','Prefer: count=minimal,return=representation',
        '-d',payload], capture_output=True, text=True)
    try:
        j = json.loads(r.stdout)
        if not j.get('code'):
            accepted.append(v)
            print(f'  ACCEPTED: {v!r}')
    except:
        if r.stdout == '':
            accepted.append(v)
            print(f'  ACCEPTED (empty resp): {v!r}')

print(f'\nTotal accepted: {len(accepted)}')
# Cleanup
subprocess.run(['curl','-s','-X','DELETE',f'{URL}/rest/v1/shipments?shipment_no=like.DIAG-POD-%',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}'], capture_output=True, text=True)