"""Inspect outbound_header + find Assembly-related tables."""
import json, subprocess, sys
from pathlib import Path

PROJECT = Path(r"D:/project/scm-tower")


def load_env():
    env = {}
    for name in (".env.local", ".env"):
        p = PROJECT / name
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env


def rest(method, path, body=None, extra_params=""):
    url = f"{URL}/rest/v1/{path}{extra_params}"
    cmd = [
        "curl", "-s", "-X", method, url,
        "-H", f"Authorization: Bearer {KEY}",
        "-H", f"apikey: {KEY}",
        "-H", "Content-Type: application/json",
    ]
    if method == "POST":
        cmd += ["-H", "Prefer: return=representation", "-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = r.stdout.strip()
    if not out:
        return {"_raw": "", "_stderr": r.stderr[:300]}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"_raw": out[:500]}


env = load_env()
URL = env.get("NEXT_PUBLIC_SUPABASE_URL") or env.get("SUPABASE_URL")
KEY = (env.get("SUPABASE_SERVICE_ROLE_KEY")
       or env.get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"))

if not URL or not KEY:
    print("MISSING env")
    sys.exit(1)

# outbound_header schema
res = rest("GET", "outbound_header", extra_params="?select=*&limit=1")
print("=== outbound_header COLUMNS ===")
if isinstance(res, list) and res:
    for k, v in res[0].items():
        print(f"  {k:28} = {type(v).__name__:10} {str(v)[:45]!r}")
else:
    print(res)

res2 = rest("GET", "outbound_header", extra_params="?select=id")
print(f"\ntotal outbound_header rows: {len(res2) if isinstance(res2, list) else res2}")

# outbound_detail: distinct document_no prefixes
res3 = rest("GET", "outbound_detail",
            extra_params="?select=document_no,document_type,entry_type,is_sale,qty_in,qty_out&limit=2000")
if isinstance(res3, list):
    pref = {}
    types = {}
    for r in res3:
        dn = str(r.get("document_no") or "")
        p = dn.split("-")[0] if "-" in dn else dn[:4]
        pref[p] = pref.get(p, 0) + 1
        key = (r.get("document_type"), r.get("entry_type"), r.get("is_sale"))
        types[key] = types.get(key, 0) + 1
    print("\n=== document_no prefix distribution ===")
    for p, c in sorted(pref.items(), key=lambda x: -x[1])[:15]:
        print(f"  {p!r}: {c}")
    print("\n=== (document_type, entry_type, is_sale) ===")
    for k, c in sorted(types.items(), key=lambda x: -x[1])[:12]:
        print(f"  {k}: {c}")

# check for assembly-related tables
print("\n=== assembly tables probe ===")
for tbl in ("assembly_detail", "outbound_assembly", "posted_assembly"):
    r = rest("GET", tbl, extra_params="?select=*&limit=1")
    if isinstance(r, list) and r:
        print(f"  {tbl}: EXISTS, cols={list(r[0].keys())}")
    elif isinstance(r, dict) and r.get("code"):
        print(f"  {tbl}: {r.get('code')} {str(r.get('message'))[:60]}")
    else:
        print(f"  {tbl}: empty/other")

# distinct qty_in non-zero (assembly entries are positive inbound)
res4 = rest("GET", "outbound_detail",
            extra_params="?select=entry_no,document_no,qty_in,qty_out,entry_type,is_sale&qty_in=gt.0&limit=20")
print("\n=== rows with qty_in > 0 (possible assembly) ===")
if isinstance(res4, list):
    for r in res4[:20]:
        print(f"  entry_no={r.get('entry_no')} doc={r.get('document_no')} "
              f"in={r.get('qty_in')} out={r.get('qty_out')} type={r.get('entry_type')}")
else:
    print(res4)