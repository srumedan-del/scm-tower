#!/usr/bin/env python3
"""
Upload PTR Detail ke Database SCM Tower (tabel: receiving_detail)

Reads: C:/tmp/PTR_Detail_TransferReceipt_MDN-PAR.csv
DB:    Supabase REST API (PostgREST) - konsisten dengan lib/supabaseAdmin.ts

Credentials dibaca dari .env / .env.local di project root (TIDAK PERNAH dicetak).

Usage:
    python upload_ptr_detail.py --csv /path/to/file.csv [--dry-run]
    python upload_ptr_detail.py --csv /path/to/file.csv --yes
"""

import argparse
import csv
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
TABLE = "receiving_detail"


def load_env():
    """Load credentials from .env / .env.local - never printed."""
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


ENV = load_env()
URL = ENV.get("NEXT_PUBLIC_SUPABASE_URL") or ENV.get("SUPABASE_URL")
KEY = (ENV.get("SUPABASE_SERVICE_ROLE_KEY")
       or ENV.get("NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"))

if not URL or not KEY:
    print("ERROR: Supabase credentials not found in .env / .env.local")
    sys.exit(1)


def rest(method, path, body=None, extra_params=""):
    """Call Supabase REST API. Returns parsed JSON."""
    url = f"{URL}/rest/v1/{path}{extra_params}"
    cmd = [
        "curl", "-s", "-X", method, url,
        "-H", f"Authorization: Bearer {KEY}",
        "-H", f"apikey: {KEY}",
        "-H", "Content-Type: application/json",
    ]
    if method == "POST":
        cmd += ["-H", "Prefer: resolution=ignore",
                "-H", "Prefer: return=representation",
                "-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = r.stdout.strip()
    if not out:
        return {"_raw": "", "_stderr": r.stderr[:300]}
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"_raw": out[:500]}


def excel_serial_to_date(serial):
    """Convert Excel serial number to YYYY-MM-DD string."""
    if serial is None or str(serial).strip() == "":
        return None
    try:
        serial = float(serial)
        if serial < 1:
            return None
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=int(serial))).strftime("%Y-%m-%d")
    except (ValueError, OverflowError, TypeError):
        pass
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(str(serial).strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def to_bool(value):
    if value is None or str(value).strip() == "":
        return None
    val = str(value).strip().lower()
    if val in ("true", "yes", "1"):
        return True
    if val in ("false", "no", "0"):
        return False
    return None


def to_int(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        return int(float(str(value).strip()))
    except (ValueError, TypeError):
        return None


COLUMN_MAP = {
    "Posting Date": "posting_date",
    "Entry Type": "entry_type",
    "Document Type": "document_type",
    "Document No.": "document_no",
    "Document Line No.": "document_line_no",
    "Item No.": "item_no",
    "Variant Code": "variant_code",
    "Description": "description",
    "Document Created Date/Time": "document_created_at",
    "CABANG/PERWAKILAN": "branch_representative",
    "PROJECT": "project",
    "Return Reason Code": "return_reason_code",
    "Location Code": "location_code",
    "Lot No.": "lot_no",
    "Expiration Date": "expiration_date",
    "Serial No.": "serial_no",
    "Quantity": "quantity",
    "Invoiced Quantity": "invoiced_quantity",
    "Remaining Quantity": "remaining_quantity",
    "Shipped Qty. Not Returned": "shipped_qty_not_returned",
    "Reserved Quantity": "reserved_quantity",
    "Open": "open",
    "Order Type": "order_type",
    "Entry No.": "entry_no",
}

DATE_COLUMNS_CSV = ["Posting Date", "Expiration Date", "Document Created Date/Time"]
REQUIRED_COLUMNS = ["Document No.", "Item No.", "Quantity"]


def get_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)
    conn_params = {
        "host": os.getenv("PGHOST", "localhost"),
        "port": os.getenv("PGPORT", "5432"),
        "dbname": os.getenv("PGDATABASE", "scm_tower"),
        "user": os.getenv("PGUSER"),
        "password": os.getenv("PGPASSWORD"),
    }
    if not conn_params["user"] or not conn_params["password"]:
        raise RuntimeError("Set PGUSER/PGPASSWORD or DATABASE_URL env var")
    return psycopg2.connect(**conn_params)


def read_csv_rows(csv_path):
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def validate_and_convert(row, row_idx):
    errors = []
    mapped = {}
    for csv_col, db_col in COLUMN_MAP.items():
        val = row.get(csv_col, "").strip() if csv_col in row else ""
        mapped[db_col] = val

    for req in REQUIRED_COLUMNS:
        db_col = COLUMN_MAP.get(req)
        if not mapped.get(db_col):
            errors.append(f"Row {row_idx+1}: Missing required field '{req}'")

    for csv_col in DATE_COLUMNS_CSV:
        db_col = COLUMN_MAP[csv_col]
        mapped[db_col] = excel_serial_to_date(mapped.get(db_col, ""))

    int_cols = ["quantity", "invoiced_quantity", "remaining_quantity",
                "shipped_qty_not_returned", "reserved_quantity",
                "document_line_no", "entry_no"]
    for db_col in int_cols:
        mapped[db_col] = to_int(mapped.get(db_col))

    mapped["open"] = to_bool(mapped.get("open"))

    if mapped.get("expiration_date") is None:
        mapped["expiration_date"] = "9999-12-31"

    now = datetime.now().isoformat()
    mapped["created_at"] = now
    mapped["updated_at"] = now

    return mapped, errors


def insert_rows(rows, dry_run=False):
    """Insert rows into receiving_detail via Supabase REST API."""
    if not rows:
        return 0, 0

    inserted = 0
    failed = 0

    if dry_run:
        print(f"[DRY RUN] Would insert {len(rows)} rows into receiving_detail")
        return len(rows), 0

    for i, row in enumerate(rows):
        try:
            res = rest("POST", TABLE, body=row)
            if isinstance(res, list):
                inserted += 1
            elif isinstance(res, dict) and res.get("code"):
                print(f"  ERROR row {i+1}: {res.get('message', res.get('details', 'unknown'))}")
                failed += 1
            else:
                inserted += 1
        except Exception as e:
            print(f"  ERROR row {i+1}: {e}")
            failed += 1

    return inserted, failed


def main():
    parser = argparse.ArgumentParser(
        description="Upload PTR Detail to receiving_detail table")
    parser.add_argument(
        "--csv",
        default=r"C:/tmp/PTR_Detail_TransferReceipt_MDN-PAR.csv",
        help="Path to CSV file")
    parser.add_argument("--dry-run", action="store_true",
                        help="Validate without inserting")
    parser.add_argument("--yes", action="store_true",
                        help="Skip confirmation prompt")
    args = parser.parse_args()

    if not os.path.exists(args.csv):
        print(f"ERROR: CSV file not found: {args.csv}")
        sys.exit(1)

    print(f"Reading CSV: {args.csv}")
    raw_rows = read_csv_rows(args.csv)
    print(f"Total rows in CSV: {len(raw_rows)}\n")

    converted = []
    errors = []
    for i, row in enumerate(raw_rows):
        mapped, row_errors = validate_and_convert(row, i)
        if row_errors:
            errors.extend(row_errors)
        else:
            converted.append(mapped)

    if errors:
        print("VALIDATION ERRORS:")
        for err in errors[:50]:
            print(f"  {err}")
        if len(errors) > 50:
            print(f"  ... and {len(errors) - 50} more")
        print()
        if not converted:
            print("No valid rows to insert. Exiting.")
            sys.exit(1)

    print(f"Valid rows: {len(converted)}")
    if errors:
        print(f"Invalid rows: {len(errors)}\n")

    if not args.yes and not args.dry_run:
        confirm = input("Proceed with INSERT to database? (y/N): ")
        if confirm.lower() not in ("y", "yes"):
            print("Cancelled.")
            sys.exit(0)

    inserted, failed = insert_rows(converted, dry_run=args.dry_run)
    print("=" * 50)
    if args.dry_run:
        print(f"DRY RUN COMPLETE - {inserted} rows would be inserted")
    else:
        print(f"INSERT COMPLETE - Success: {inserted}, Failed: {failed}")


if __name__ == "__main__":
    main()
