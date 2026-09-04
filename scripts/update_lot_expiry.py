"""update_lot_expiry.py

Update kolom lot_no dan expiration_date di outbound_detail
berdasarkan entry_no dari file ILE (Excel/CSV).

Gunakan ini kalau data sudah terlanjur masuk tanpa lot/expiry.

CARA PAKAI:
  pip install pandas openpyxl requests
  python scripts/update_lot_expiry.py outbound_detail.xlsx

OPSI:
  --dry-run   Preview tanpa update ke DB
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    print("pip install pandas openpyxl"); sys.exit(1)
try:
    import requests
except ImportError:
    print("pip install requests"); sys.exit(1)

SUPABASE_URL = "https://elwzpofgxgauyssatgac.supabase.co"
SERVICE_KEY  = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd3pwb2ZneGdhdXlzc2F0Z2FjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMxNjM0MywiZXhwIjoyMTAyODkyMzQzfQ"
    ".0fEGVyDXRFsJVF94iKEen4Vcy4HlHbyKaULlwoI7Kz8"
)
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def normalize_col(c: str) -> str:
    return c.strip().lower().replace(" ", "_").replace(".", "_").replace("-", "_")


def pick(row: dict, aliases: list) -> str | None:
    for alias in aliases:
        norm = normalize_col(alias)
        for k, v in row.items():
            if normalize_col(k) == norm:
                sv = str(v).strip() if v is not None else ''
                if sv and sv.lower() not in ('nan', 'none', 'nat'):
                    return sv
    return None


def to_iso_date(val: str | None) -> str | None:
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(val[:10]).strftime("%Y-%m-%d")
    except Exception:
        return None


def update_batch(updates: list[dict]) -> tuple[int, list[str]]:
    """Update rows satu-satu by entry_no."""
    updated = 0
    errors  = []
    for u in updates:
        entry_no = u['entry_no']
        payload  = {k: v for k, v in u.items() if k != 'entry_no'}
        url = f"{SUPABASE_URL}/rest/v1/outbound_detail?entry_no=eq.{entry_no}"
        resp = requests.patch(url, headers={**HEADERS, "Prefer": "return=minimal"},
                              data=json.dumps(payload))
        if resp.ok:
            updated += 1
        else:
            errors.append(f"entry_no={entry_no}: {resp.text[:100]}")
    return updated, errors


def main():
    parser = argparse.ArgumentParser(description="Update lot_no & expiration_date di outbound_detail")
    parser.add_argument("input", help="File ILE (.xlsx/.csv)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    path = Path(args.input)
    if not path.exists():
        print(f"File tidak ditemukan: {path}"); sys.exit(1)

    if path.suffix.lower() in ('.xlsx', '.xls'):
        df = pd.read_excel(path, dtype=str)
    else:
        df = pd.read_csv(path, dtype=str)

    print(f"File  : {path.name}")
    print(f"Baris : {len(df)}")

    updates = []
    for _, row in df.iterrows():
        r = {k: (None if pd.isna(v) else v) for k, v in row.items()}
        entry_no = pick(r, ['entry_no'])
        lot_no   = pick(r, ['lot_no', 'lot_no_', 'lot'])
        exp_raw  = pick(r, ['expiration_date', 'expiry_date', 'exp_date', 'lot_expiration_date'])
        exp_date = to_iso_date(exp_raw)

        if not entry_no:
            continue
        if not lot_no and not exp_date:
            continue  # tidak ada yang perlu di-update

        upd: dict = {'entry_no': int(float(entry_no))}
        if lot_no:
            upd['lot_no'] = lot_no
        if exp_date:
            upd['expiration_date'] = exp_date
        updates.append(upd)

    print(f"Baris dengan lot/expiry : {len(updates)}")

    if not updates:
        print("Tidak ada yang perlu di-update."); return

    if args.dry_run:
        print("\n[DRY RUN] Sample 5 baris:")
        for u in updates[:5]:
            print(f"  entry_no={u['entry_no']} lot={u.get('lot_no','-')} exp={u.get('expiration_date','-')}")
        return

    print(f"Update {len(updates)} baris...")
    CHUNK = 200
    total_updated = 0
    total_errors  = []

    for i in range(0, len(updates), CHUNK):
        batch = updates[i:i+CHUNK]
        n, errs = update_batch(batch)
        total_updated += n
        total_errors.extend(errs)
        print(f"  Batch {i//CHUNK+1}: {n}/{len(batch)} updated")

    print(f"\nSelesai: {total_updated} baris di-update")
    if total_errors:
        print(f"Errors ({len(total_errors)}):")
        for e in total_errors[:5]: print(f"  {e}")


if __name__ == "__main__":
    main()
