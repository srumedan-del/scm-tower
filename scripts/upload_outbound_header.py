"""upload_outbound_header.py

Upload file PSS Header (outbound_header) langsung ke Supabase.
Skip baris yang sudah ada (berdasarkan shipment_no / pss_no).

CARA PAKAI:
  pip install pandas openpyxl requests
  python scripts/upload_outbound_header.py pssheader.xlsx

OPSI:
  --dry-run   Lihat preview tanpa insert ke DB
"""

import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

try:
    import pandas as pd
except ImportError:
    print("❌  pip install pandas openpyxl")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("❌  pip install requests")
    sys.exit(1)

# ── Supabase config ───────────────────────────────────────────────────────────
SUPABASE_URL = "https://elwzpofgxgauyssatgac.supabase.co"
SERVICE_ROLE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsd3pwb2ZneGdhdXlzc2F0Z2FjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMxNjM0MywiZXhwIjoyMTAyODkyMzQzfQ"
    ".0fEGVyDXRFsJVF94iKEen4Vcy4HlHbyKaULlwoI7Kz8"
)
TABLE = "outbound_header"
HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

# ── Field mapping ─────────────────────────────────────────────────────────────
# key = nama kolom DB, value = daftar alias kolom di Excel (case-insensitive)
FIELD_MAP = {
    "pss_no":                 ["pss_no", "pss", "no", "no_", "document_no", "doc_no", "shipment_no"],
    "shipment_no":            ["shipment_no", "pss_no", "pss", "no", "no_", "document_no"],
    "posting_date":           ["posting_date", "posted_date", "posting_dt"],
    "document_date":          ["document_date", "doc_date", "order_date"],
    "location_code":          ["location_code", "location", "loc", "location_filter"],
    "branch_representative":  ["cabang_perwakilan", "branch_representative", "branch", "cabang"],
    "project":                ["project"],
    "order_no":               ["order_no", "sales_order_no", "so_no", "sop_no"],
    "customer_no":            ["customer_no", "cust_no", "sell_to_customer_no"],
    "customer_name":          ["customer_name", "cust_name", "sell_to_customer_name"],
    "ship_to_city":           ["ship_to_city", "city", "kota"],
    "cust_receipt_date":      ["cust_receipt_date", "receipt_date", "received_date"],
    "promised_delivery_date": ["promised_delivery_date", "promised_date", "due_date", "requested_delivery_date"],
    "shipping_agent_code":    ["shipping_agent_code", "shipping_agent", "agent_code"],
    "currency_code":          ["currency_code", "currency"],
    "no_printed":             ["no_printed"],
    "package_tracking_no":    ["package_tracking_no", "tracking_no", "tracking"],
}

DATE_FIELDS = {
    "posting_date", "document_date", "cust_receipt_date", "promised_delivery_date"
}


def normalize_col(c: str) -> str:
    return c.strip().lower().replace(" ", "_").replace(".", "_").replace("-", "_")


def pick(row: dict, aliases: list[str]):
    for alias in aliases:
        norm = normalize_col(alias)
        for k, v in row.items():
            if normalize_col(k) == norm:
                if v is not None and str(v).strip() not in ("", "nan", "NaT", "None"):
                    return str(v).strip()
    return None


def to_iso_date(val: str | None) -> str | None:
    if not val:
        return None
    # Coba berbagai format
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y%m%d"):
        try:
            return datetime.strptime(val, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    # Kalau sudah ISO-like (2026-09-03 00:00:00)
    try:
        return datetime.fromisoformat(val[:10]).strftime("%Y-%m-%d")
    except Exception:
        return val  # kembalikan apa adanya


def map_row(raw: dict, source_file: str) -> dict | None:
    row = {k: (None if pd.isna(v) else v) for k, v in raw.items()}
    now = datetime.utcnow().isoformat()

    record: dict = {}
    for db_col, aliases in FIELD_MAP.items():
        val = pick(row, aliases)
        if db_col in DATE_FIELDS:
            val = to_iso_date(val)
        record[db_col] = val

    # Fallback pss_no ↔ shipment_no
    if not record.get("pss_no") and record.get("shipment_no"):
        record["pss_no"] = record["shipment_no"]
    if not record.get("shipment_no") and record.get("pss_no"):
        record["shipment_no"] = record["pss_no"]

    # Wajib ada salah satu
    if not record.get("pss_no") and not record.get("shipment_no"):
        return None

    record["source_file"] = source_file
    record["import_period"] = now[:7]
    record["created_at"] = now
    record["updated_at"] = now

    # Hapus field None
    return {k: v for k, v in record.items() if v is not None}


def get_existing(pss_nos: list[str]) -> set[str]:
    """Ambil shipment_no yang sudah ada di DB."""
    if not pss_nos:
        return set()
    # Query in chunks of 100
    existing = set()
    chunk_size = 100
    for i in range(0, len(pss_nos), chunk_size):
        chunk = pss_nos[i:i + chunk_size]
        vals = ",".join(chunk)
        url = f"{SUPABASE_URL}/rest/v1/{TABLE}?select=shipment_no,pss_no&shipment_no=in.({vals})"
        resp = requests.get(url, headers=HEADERS)
        if resp.ok:
            for r in resp.json():
                if r.get("shipment_no"):
                    existing.add(str(r["shipment_no"]).strip())
                if r.get("pss_no"):
                    existing.add(str(r["pss_no"]).strip())
    return existing


def insert_batch(rows: list[dict]) -> tuple[int, list[str]]:
    """Insert batch, return (inserted_count, errors)."""
    if not rows:
        return 0, []

    url = f"{SUPABASE_URL}/rest/v1/{TABLE}"
    # Pakai upsert dengan on-conflict shipment_no, ignore duplicates
    upsert_headers = {
        **HEADERS,
        "Prefer": "resolution=ignore-duplicates,return=representation",
        "on-conflict": "shipment_no",
    }
    resp = requests.post(url, headers=upsert_headers, data=json.dumps(rows))

    if resp.ok:
        return len(resp.json()), []
    else:
        err = resp.json()
        # Kalau masih 23505, insert satu-satu dan skip yang conflict
        if isinstance(err, dict) and err.get("code") == "23505":
            inserted = 0
            errors = []
            for row in rows:
                r2 = requests.post(url, headers={**HEADERS, "Prefer": "return=minimal"}, data=json.dumps([row]))
                if r2.ok:
                    inserted += 1
                elif r2.status_code == 409:
                    pass  # sudah ada, skip
                else:
                    errors.append(f"Row {row.get('pss_no','?')}: {r2.text}")
            return inserted, errors
        return 0, [str(err)]


def main():
    parser = argparse.ArgumentParser(description="Upload PSS Header ke Supabase")
    parser.add_argument("input", help="File Excel/CSV (.xlsx, .xls, .csv)")
    parser.add_argument("--dry-run", action="store_true", help="Preview tanpa insert")
    parser.add_argument("--batch-size", type=int, default=50, help="Ukuran batch insert (default: 50)")
    args = parser.parse_args()

    path = Path(args.input)
    if not path.exists():
        print(f"❌  File tidak ditemukan: {path}")
        sys.exit(1)

    # Baca file
    if path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path, dtype=str)
    else:
        df = pd.read_csv(path, dtype=str)

    print(f"\nFile   : {path.name}")
    print(f"Baris  : {len(df)}")
    print(f"Kolom  : {list(df.columns)}\n")

    # Map semua baris
    mapped = [map_row(row, path.name) for row in df.to_dict("records")]
    valid = [r for r in mapped if r is not None]
    invalid = len(mapped) - len(valid)

    print(f"Baris valid   : {len(valid)}")
    print(f"Baris invalid : {invalid} (tidak ada pss_no/shipment_no)")

    if not valid:
        print("\n❌  Tidak ada baris valid. Cek nama kolom di file.")
        sys.exit(1)

    # Cek existing di DB
    all_pss = list({str(r.get("pss_no", r.get("shipment_no", ""))).strip() for r in valid})
    print(f"\nCek {len(all_pss)} PSS No. di database...")
    existing = get_existing(all_pss)
    print(f"Sudah ada di DB : {len(existing)}")

    to_insert = [r for r in valid if str(r.get("pss_no", r.get("shipment_no", ""))).strip() not in existing]
    skipped = len(valid) - len(to_insert)
    print(f"Akan diinsert  : {len(to_insert)}")
    print(f"Akan dilewati  : {skipped}")

    if args.dry_run:
        print("\n[DRY RUN] Preview 5 baris pertama yang akan diinsert:")
        for r in to_insert[:5]:
            print(f"  {r.get('pss_no')} | {r.get('customer_name')} | {r.get('posting_date')}")
        print("\nDry run selesai. Tidak ada yang diinsert.")
        return

    if not to_insert:
        print("\n✅  Semua PSS No. sudah ada di database. Tidak ada yang diinsert.")
        return

    # Insert batch
    print(f"\nInsert {len(to_insert)} baris dalam batch {args.batch_size}...")
    total_inserted = 0
    all_errors = []

    for i in range(0, len(to_insert), args.batch_size):
        batch = to_insert[i:i + args.batch_size]
        n, errs = insert_batch(batch)
        total_inserted += n
        all_errors.extend(errs)
        print(f"  Batch {i // args.batch_size + 1}: {n}/{len(batch)} inserted")

    print(f"\n{'─'*50}")
    print(f"✅  Selesai!")
    print(f"   Inserted : {total_inserted}")
    print(f"   Skipped  : {skipped}")
    if all_errors:
        print(f"   Errors   : {len(all_errors)}")
        for e in all_errors[:5]:
            print(f"     {e}")


if __name__ == "__main__":
    main()
