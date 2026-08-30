"""Full extract: get all unique SKU from outbound_detail & receiving_detail across ALL rows."""
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

def fetch_all(table, select, page_size=1000):
    all_rows = []
    offset = 0
    while True:
        url = f"{URL}/rest/v1/{table}?select={select}&offset={offset}&limit={page_size}"
        r = subprocess.run(['curl','-s',url,
            '-H',f'Authorization: Bearer {KEY}',
            '-H',f'apikey: {KEY}'], capture_output=True, text=True)
        rows = json.loads(r.stdout)
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
    return all_rows

print("=== Fetching outbound_detail (all 4693 rows) ===")
outbound = fetch_all('outbound_detail', 'item_no,description,quantity')
print(f"Total: {len(outbound)}")

print("\n=== Fetching receiving_detail (all rows) ===")
receiving = fetch_all('receiving_detail', 'item_no,description,quantity')
print(f"Total: {len(receiving)}")

# Aggregate
sku_map = {}
def add(code, desc, qty):
    if not code: return
    if code not in sku_map:
        sku_map[code] = {'item_no': code, 'descriptions': set(), 'total_qty': 0, 'outbound_count': 0, 'receiving_count': 0}
    if desc: sku_map[code]['descriptions'].add(desc)
    sku_map[code]['total_qty'] += abs(qty)

for r in outbound:
    add(r.get('item_no'), r.get('description'), r.get('quantity', 0))
    if r.get('item_no') in sku_map:
        sku_map[r['item_no']]['outbound_count'] += 1

for r in receiving:
    add(r.get('item_no'), r.get('description'), r.get('quantity', 0))
    if r.get('item_no') in sku_map:
        sku_map[r['item_no']]['receiving_count'] += 1

print(f"\nTotal unique SKU: {len(sku_map)}")
print(f"SKU with description: {sum(1 for s in sku_map.values() if s['descriptions'])}")
print(f"SKU only in outbound: {sum(1 for s in sku_map.values() if s['outbound_count'] > 0 and s['receiving_count'] == 0)}")
print(f"SKU only in receiving: {sum(1 for s in sku_map.values() if s['receiving_count'] > 0 and s['outbound_count'] == 0)}")
print(f"SKU in both: {sum(1 for s in sku_map.values() if s['outbound_count'] > 0 and s['receiving_count'] > 0)}")

# Save for next step
out = {k: {**v, 'descriptions': list(v['descriptions'])} for k, v in sku_map.items()}
with open(r'C:\Users\LENOVO\AppData\Local\Temp\sku_extract_full.json', 'w') as f:
    json.dump(out, f, indent=2)
print(f"\nSaved to sku_extract_full.json")

# Print top 30
print("\n=== TOP 30 SKUs by qty ===")
for code, info in sorted(sku_map.items(), key=lambda x: -x[1]['total_qty'])[:30]:
    descs = ', '.join(list(info['descriptions'])[:1]) if info['descriptions'] else '(no desc)'
    print(f"  {code:25} | qty={info['total_qty']:>8} | ob={info['outbound_count']:>4} | rc={info['receiving_count']:>3} | {descs[:50]}")