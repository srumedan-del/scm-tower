"""
Comprehensive brute force for shipment pod_status constraint.
Strategy: try standard POD-related enum values from common shipping systems.
"""
import subprocess, json
from pathlib import Path
env_path = Path(r"D:/scm-app/scm-tower/.env.local")
env = {}
for line in env_path.read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
URL = env['NEXT_PUBLIC_SUPABASE_URL']
KEY = env['NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY']

# Brute force: standard POD enums across different shipping systems
candidates = [
    # Standard statuses
    'OPEN','IN_PROGRESS','COMPLETED','CANCELLED','PENDING','ACTIVE','INACTIVE',
    # POD-specific
    'PENDING','RECEIVED','VERIFIED','REJECTED','MISSING','COLLECTED','SIGNED',
    'UNSIGNED','UPLOADED','NOT_UPLOADED','PARTIAL','FULL','AVAILABLE',
    # Indonesian
    'TERIMA','BELUM','SUDAH','TIDAK','PROSES','SELESAI',
    # With underscore prefix
    '_PENDING','_RECEIVED',
    # Lowercase variants already tried
    # Common in ERP
    'OPEN_POD','CLOSED_POD','NEW','OLD','CLEARED',
    # Boolean-like
    'Y','N','YES','NO','TRUE','FALSE','1','0',
    # Status code
    '0','1','2','3','4','5','00','10','20','30',
    # Misc
    'EMPTY','NONE','NULL','NA','N/A','-','OK','NOT_OK','DONE',
    # Tracking-style
    'TRANSIT','OUT_FOR_DELIVERY','DELIVERED','RETURNED','EXCEPTION',
    # SCM-specific
    'OPEN','CLOSE','PROCESSED','UNPROCESSED','TO_DO','DOING',
]

# Try each
for v in candidates:
    payload = json.dumps({'shipment_no': f'BF-{abs(hash(v))%99999999}', 'shipment_date': '2026-08-30', 'shipment_type': 'COURIER', 'status': 'planned', 'pod_status': v, 'delay_duration_minutes': 0})
    r = subprocess.run(['curl','-s','-X','POST',f'{URL}/rest/v1/shipments',
        '-H',f'Authorization: Bearer {KEY}',
        '-H',f'apikey: {KEY}',
        '-H','Content-Type: application/json',
        '-H','Prefer: count=minimal',
        '-d',payload], capture_output=True, text=True)
    try:
        j = json.loads(r.stdout)
        if not j.get('code'):
            print(f'  ✓ ACCEPTED: pod_status={v!r}')
    except:
        if not r.stdout.strip():
            print(f'  ✓ ACCEPTED (empty): pod_status={v!r}')

# cleanup
subprocess.run(['curl','-s','-X','DELETE',f'{URL}/rest/v1/shipments?shipment_no=like.BF-%',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}'], capture_output=True, text=True)
print('done')