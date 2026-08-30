"""Extract unique SKU from outbound_detail & receiving_detail, with item name & description."""
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

def fetch_all(table, select, extra=''):
    url = f"{URL}/rest/v1/{table}?select={select}&limit=1000{extra}"
    r = subprocess.run(['curl','-s',url,
        '-H',f'Authorization: Bearer {KEY}',
        '-H',f'apikey: {KEY}'], capture_output=True, text=True)
    return json.loads(r.stdout)

print("=== Unique item_no + descriptions from outbound_detail (1000 rows) ===")
outbound = fetch_all('outbound_detail', 'item_no,description,quantity')
print(f"Total rows: {len(outbound)}")

# Build SKU map: item_no -> { descriptions: [], total_qty, count }
sku_map = {}
for r in outbound:
    code = r.get('item_no')
    if not code: continue
    if code not in sku_map:
        sku_map[code] = {'item_no': code, 'descriptions': [], 'total_qty': 0, 'count': 0, 'branch': set()}
    if r.get('description') and r['description'] not in sku_map[code]['descriptions']:
        sku_map[code]['descriptions'].append(r['description'])
    sku_map[code]['total_qty'] += abs(r.get('quantity', 0))
    sku_map[code]['count'] += 1

print(f"\nUnique SKU codes found: {len(sku_map)}")
for code, info in sorted(sku_map.items(), key=lambda x: -x[1]['count'])[:30]:
    descs = ', '.join(info['descriptions'][:2]) if info['descriptions'] else '(no description)'
    print(f"  {code:30} | qty={info['total_qty']:>8} | n={info['count']:>3} | {descs[:60]}")

# Also check receiving_detail
print("\n=== Unique item_no from receiving_detail ===")
recv = fetch_all('receiving_detail', 'item_no,description,quantity')
sku_recv = {}
for r in recv:
    code = r.get('item_no')
    if not code: continue
    if code not in sku_recv:
        sku_recv[code] = {'item_no': code, 'descriptions': [], 'total_qty': 0, 'count': 0}
    if r.get('description') and r['description'] not in sku_recv[code]['descriptions']:
        sku_recv[code]['descriptions'].append(r['description'])
    sku_recv[code]['total_qty'] += abs(r.get('quantity', 0))
    sku_recv[code]['count'] += 1

print(f"Unique SKU codes from receiving: {len(sku_recv)}")
new_in_recv = set(sku_recv.keys()) - set(sku_map.keys())
print(f"New SKU only in receiving: {len(new_in_recv)}")
for code in sorted(new_in_recv, key=lambda x: -sku_recv[x]['count'])[:10]:
    info = sku_recv[code]
    descs = ', '.join(info['descriptions'][:2]) if info['descriptions'] else '(no description)'
    print(f"  {code:30} | qty={info['total_qty']:>8} | n={info['count']:>3} | {descs[:60]}")

# Save combined mapping for next step
all_skus = {**sku_map, **sku_recv}
with open(r'C:\Users\LENOVO\AppData\Local\Temp\sku_extract.json', 'w') as f:
    json.dump(all_skus, f, indent=2)
print(f"\nSaved {len(all_skus)} SKUs to sku_extract.json")