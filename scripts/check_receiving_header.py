"""Check receiving_header table to map PTR document_no -> header id."""
import json
import os
import subprocess
import sys
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

# Get all receiving headers with ptr_no and id
res = rest("GET", "receiving_header",
           extra_params="?select=id,ptr_no,posting_date&order=ptr_no.desc&limit=200")
print("=== receiving_header mapping ===")
if isinstance(res, list):
    for r in res:
        print(f"  {r.get('ptr_no'):20} -> id={r.get('id')} (posting: {r.get('posting_date')})")
    print(f"\nTotal headers: {len(res)}")
else:
    print(res)

# Also check for our specific PTR documents
target_ptrs = ["PTR-2610-0612", "PTR-2609-1052", "PTR-2609-1015", "PTR-2609-1014"]
for ptr in target_ptrs:
    res2 = rest("GET", "receiving_header", extra_params=f"?select=id,ptr_no&ptr_no=eq.{ptr}")
    if isinstance(res2, list) and res2:
        print(f"  HEADER for {ptr}: id={res2[0]['id']}")
    else:
        print(f"  NO HEADER for {ptr}")