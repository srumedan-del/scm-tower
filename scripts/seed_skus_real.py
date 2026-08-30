"""Replace dummy SKUs with real extracted SKUs."""
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

# 1. Delete dummy SKUs (MED-*)
print("=== Deleting dummy SKUs ===")
code, out = rest('DELETE', "/rest/v1/master_sku?sku_code=like.MED-*", prefer='return=representation')
print(f"  exit={code}, response preview: {out[:200]}")

# 2. Load extracted SKUs
with open(r'C:\Users\LENOVO\AppData\Local\Temp\sku_extract_full.json') as f:
    extracted = json.load(f)

# 3. Build master_sku rows
print(f"\n=== Building master_sku rows for {len(extracted)} SKUs ===")
rows = []
for code, info in extracted.items():
    # Determine category based on naming pattern
    desc_list = info['descriptions']
    item_name = desc_list[0] if desc_list else code

    # Pattern recognition for category
    code_upper = code.upper()
    if 'HD SET' in code_upper or 'HD PACK' in code_upper or 'BLMDN' in code_upper:
        category = 'HD Set'
        uom = 'set'
    elif code_upper.startswith('DS') or 'L' in code_upper.split('-')[-1]:
        category = 'Dialyzer'
        uom = 'pcs'
    elif code_upper.startswith('AVF') or 'F' in code_upper.split('-')[-1]:
        category = 'Blood Tubing'
        uom = 'pcs'
    elif code_upper.startswith('NIC'):
        category = 'Dialyzer'
        uom = 'pcs'
    elif code_upper.startswith('ELISIO'):
        category = 'Dialyzer'
        uom = 'pcs'
    elif code_upper.startswith('AK') or code_upper.startswith('ATS') or code_upper.startswith('AT1'):
        category = 'Blood Tubing'
        uom = 'pcs'
    elif 'PDM' in code_upper or 'PDL' in code_upper:
        category = 'PD Solution'
        uom = 'bag'
    elif code_upper.startswith('LDT') or code_upper.startswith('FG'):
        category = 'Accessories'
        uom = 'pcs'
    elif code_upper.startswith('W-CATH') or 'CATH' in code_upper:
        category = 'Catheter'
        uom = 'pcs'
    elif code_upper.startswith('PR-'):
        category = 'Accessories'
        uom = 'pcs'
    elif code_upper.startswith('SFE') or code_upper.startswith('SFL') or code_upper.startswith('FB'):
        category = 'Filter'
        uom = 'pcs'
    elif '7751' in code_upper:
        category = 'PD Solution'
        uom = 'bag'
    elif '7022V' in code_upper:
        category = 'PD Solution'
        uom = 'bag'
    else:
        category = 'Medical Device'
        uom = 'pcs'

    rows.append({
        'sku_code': code,
        'item_name': item_name[:100],  # truncate to be safe
        'category': category,
        'uom': uom,
        'safety_stock': None,  # belum tahu, biar NULL
        'is_active': True,
    })

print(f"Built {len(rows)} rows. Sample:")
for r in rows[:5]:
    print(f"  {r['sku_code']:25} | {r['category']:15} | {r['item_name'][:40]}")

# 4. Insert in batches of 50 to avoid timeout
print(f"\n=== Inserting to master_sku (batches of 50) ===")
batch_size = 50
total_inserted = 0
errors = []
for i in range(0, len(rows), batch_size):
    batch = rows[i:i+batch_size]
    code, out = rest('POST', '/rest/v1/master_sku', batch)
    try:
        inserted = json.loads(out)
        if isinstance(inserted, list):
            total_inserted += len(inserted)
            print(f"  Batch {i//batch_size + 1}: inserted {len(inserted)}")
        else:
            errors.append((i, out[:200]))
            print(f"  Batch {i//batch_size + 1}: ERROR - {out[:200]}")
    except:
        errors.append((i, out[:200]))

print(f"\nTotal inserted: {total_inserted}")
print(f"Errors: {len(errors)}")

# 5. Verify
print("\n=== Final count ===")
code, out = rest('GET', '/rest/v1/master_sku?select=id', prefer='count=exact')
try:
    print(f"  master_sku: {len(json.loads(out))}")
except:
    print(f"  parse error")