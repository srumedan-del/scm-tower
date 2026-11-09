"""Inspect receiving_detail schema + existing data via Supabase REST API.

Reads credentials from .env / .env.local locally.
NEVER prints the key.
"""
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
    print("MISSING env: URL=%s KEY=%s" % (bool(URL), bool(KEY)))
    sys.exit(1)

print("Supabase host:", URL.split("//")[-1].split("/")[0])
print()

# 1. Schema: one row reveals all columns
res = rest("GET", "receiving_detail", extra_params="?select=*&limit=1")
if isinstance(res, list) and res:
    print("=== receiving_detail COLUMNS ===")
    for k, v in res[0].items():
        print(f"  {k:28} = {type(v).__name__:10} {str(v)[:40]!r}")
elif isinstance(res, dict) and res.get("code"):
    print("ERROR querying receiving_detail:", res)
else:
    print("Table query result:", json.dumps(res)[:600])

# 2. Row count
res2 = rest("GET", "receiving_detail", extra_params="?select=id")
print("\n=== existing row count ===")
print(len(res2) if isinstance(res2, list) else res2)

# 3. Distinct document_no present (sample)
res3 = rest("GET", "receiving_detail",
            extra_params="?select=document_no&order=document_no.desc&limit=15")
print("\n=== latest document_no in DB ===")
if isinstance(res3, list):
    for r in res3:
        print("  ", r.get("document_no"))
else:
    print(res3)
