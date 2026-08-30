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
    p = {'issue_no': f'T-{abs(hash(label))}', 'category': 'Vendor', 'title': 'X', 'description': 'X', 'impact': 'X', 'status': 'open'}
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
    else:
        msg = j.get('message','')[:80]
    print(f'  REJECTED: {label} -> {msg}')

# Test impact values
for impact in ['', 'x', 'low', 'medium', 'high', 'L', 'M', 'H', 'low_impact', 'medium_impact', 'high_impact']:
    try_insert(f'impact={impact!r}', impact=impact, title='X' * 5, description='X' * 5, issue_date='2026-08-30')

# Test impact length
for n in [1, 5, 10, 50, 100, 200, 500]:
    try_insert(f'impact len={n}', impact='X' * n, title='X' * 5, description='X' * 5, issue_date='2026-08-30')

# Test title length
for n in [1, 5, 10, 50, 100, 200, 500]:
    try_insert(f'title len={n}', title='Y' * n, description='Z' * 10, impact='imp', issue_date='2026-08-30')

# Test category
for cat in ['Vendor', 'Other', 'Test', 'low', 'medium', 'high']:
    try_insert(f'category={cat}', category=cat, impact='imp', title='abc', description='desc', issue_date='2026-08-30')

# Test status values
for s in ['open','in_progress','resolved','closed','done','active','pending']:
    try_insert(f'status={s}', status=s, impact='imp', title='abc', description='desc', issue_date='2026-08-30')

# Test probability
for p in ['low','medium','high','L','M','H','0.5','0.3','0.8','1','0']:
    try_insert(f'probability={p}', probability=p, impact='imp', title='abc', description='desc', issue_date='2026-08-30')

# cleanup
subprocess.run(['curl','-s','-X','DELETE',f'{URL}/rest/v1/issue_log?issue_no=like.T-%',
    '-H',f'Authorization: Bearer {KEY}',
    '-H',f'apikey: {KEY}'], capture_output=True, text=True)
print('done')