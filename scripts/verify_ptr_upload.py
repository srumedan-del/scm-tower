"""Verify PTR-2610-0612 data in receiving_detail after upload."""
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

# Total rows
res = rest("GET", "receiving_detail", extra_params="?select=id")
total = len(res) if isinstance(res, list) else 0
print(f"Total receiving_detail rows: {total}")

# Rows for PTR-2610-0612
res = rest("GET", "receiving_detail",
           extra_params="?select=*&document_no=eq.PTR-2610-0612&order=id")
if isinstance(res, list):
    print(f"Rows for PTR-2610-0612: {len(res)}")
    # Show entry_no distribution
    entry_nos = [r.get("entry_no") for r in res]
    unique_entry_nos = set(entry_nos)
    print(f"Unique entry_no: {len(unique_entry_nos)}")
    # Show first 5 and last 5
    print("\nFirst 5 rows:")
    for r in res[:5]:
        print(f"  id={r.get('id')} entry_no={r.get('entry_no')} item_no={r.get('item_no')} qty={r.get('quantity')}")
    print("\nLast 5 rows:")
    for r in res[-5:]:
        print(f"  id={r.get('id')} entry_no={r.get('entry_no')} item_no={r.get('item_no')} qty={r.get('quantity')}")
    # Check for any NULL entry_no
    null_entry = [r for r in res if r.get("entry_no") is None]
    print(f"\nRows with NULL entry_no: {len(null_entry)}")
    # Check for duplicate entry_no
    from collections import Counter
    cnt = Counter(entry_nos)
    dups = {k: v for k, v in cnt.items() if v > 1}
    if dups:
        print(f"WARNING: Duplicate entry_no found: {len(dups)} keys")
        for k, v in list(dups.items())[:5]:
            print(f"  entry_no={k}: {v} rows")
    else:
        print("No duplicate entry_no - all unique ✓")
else:
    print("Error:", res)