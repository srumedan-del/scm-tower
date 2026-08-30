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

def try_insert(label, **payload):
    p = {'issue_no': f'T-{abs(hash(label))}', 'category': 'Vendor', 'title': 'X' * 5, 'description': 'X' * 5, 'impact': 1, 'status': 'open'}
    p.update(payload)
    r = subprocess.run(['curl','-s','-X','POST',f'{URL}/rest/v1/issue_log',
        '-H',f'Authorization: Bearer {KEY}',
        '-H',f'apikey: {KEY}',
        '-H','Content-Type: application/json',
        '-H','Prefer: count=minimal',
        '-d',json.dumps(p)], capture_output=True, text=True)
    j = json.loads(r.stdout)
    if not j.get('code'):
        print(f'  ACCEPTED: {label}')
        return True
    msg = j.get('message','')[:80]
    print(f'  REJECTED: {label} -> {msg}')
    return False

# Test impact numeric values
for impact in [0, 1, 0.5, 0.3, 0.8, 100, '1', '0.5', 50]:
    try_insert(f'impact={impact}', impact=impact)

# Test impact as int
for impact in [1, 2, 3, 4, 5, 10, 50, 100, 0]:
    try_insert(f'impact int={impact}', impact=impact)

# Test impact as float
for impact in [0.1, 0.5, 0.8, 1.0, 2.5, 99.9]:
    try_insert(f'impact float={impact}', impact=impact)

# cleanup
subprocess.run(['curl','-s','-X','DELETE',f'{URL}/rest/v1/issue_log?issue_no=like.T-%',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}'], capture_output=True, text=True)
print('done')