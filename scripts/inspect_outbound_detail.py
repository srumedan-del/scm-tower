"""Inspect outbound_detail schema + existing data via Supabase REST API."""
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

print("Supabase host:", URL.split("//")[-1].split("/")[0])
print()

res = rest("GET", "outbound_detail", extra_params="?select=*&limit=1")
if isinstance(res, list) and res:
    print("=== outbound_detail COLUMNS ===")
    for k, v in res[0].items():
        print(f"  {k:28} = {type(v).__name__:10} {str(v)[:45]!r}")
elif isinstance(res, dict):
    print("ERROR:", res)
else:
    print("empty result")

res2 = rest("GET", "outbound_detail", extra_params="?select=id")
print(f"\n=== total rows: {len(res2) if isinstance(res2, list) else res2} ===")

res3 = rest("GET", "outbound_detail",
            extra_params="?select=document_no,posting_date,location_code,document_type&order=id.desc&limit=8")
print("\n=== latest rows ===")
if isinstance(res3, list):
    for r in res3:
        print(f"  doc={r.get('document_no')} date={r.get('posting_date')} "
              f"loc={r.get('location_code')} type={r.get('document_type')}")

# distinct document_type + location_code present
res4 = rest("GET", "outbound_detail", extra_params="?select=document_type&limit=2000")
if isinstance(res4, list):
    types = {}
    for r in res4:
        t = r.get("document_type")
        types[t] = types.get(t, 0) + 1
    print("\n=== document_type distribution (sample) ===")
    for t, c in sorted(types.items(), key=lambda x: -x[1]):
        print(f"  {t!r}: {c}")

res5 = rest("GET", "outbound_detail", extra_params="?select=location_code&limit=2000")
if isinstance(res5, list):
    locs = {}
    for r in res5:
        loc = r.get("location_code")
        locs[loc] = locs.get(loc, 0) + 1
    print("\n=== location_code distribution (sample) ===")
    for lc, c in sorted(locs.items(), key=lambda x: -x[1])[:10]:
        print(f"  {lc!r}: {c}")