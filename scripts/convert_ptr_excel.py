import pandas as pd
import re
import sys
from datetime import datetime, timedelta


def normalize_key(key: str) -> str:
    """Lowercase, replace all non-alphanumeric runs with underscore, strip edges."""
    return re.sub(r"[^a-z0-9]+", "_", key.lower()).strip("_")


def pick_column(df, aliases):
    """Return the first DataFrame column whose normalized key matches any alias."""
    norm_aliases = {normalize_key(a) for a in aliases}
    for col in df.columns:
        if normalize_key(col) in norm_aliases:
            return col
    return None


def excel_serial_to_date(serial):
    """Convert an Excel serial date number to YYYY-MM-DD string."""
    if pd.isna(serial) or serial == "" or serial is None:
        return None
    try:
        serial = float(serial)
        if serial < 1:
            return None
        # Excel epoch: 1899-12-30 (accounting for the 1900 leap-year bug)
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=int(serial))).strftime("%Y-%m-%d")
    except (ValueError, OverflowError):
        # Not a serial number — maybe already a date string
        try:
            return pd.to_datetime(serial).strftime("%Y-%m-%d")
        except Exception:
            return None


def to_date_series(series: pd.Series) -> pd.Series:
    """Convert a column that may contain Excel serial numbers or strings to date strings."""
    return series.apply(excel_serial_to_date)


def map_excel_to_receiving_header(excel_path: str, output_path: str):
    df = pd.read_excel(excel_path)

    # --- debug: show raw Excel structure ---
    print("Excel columns:", df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head().to_string())

    # Mapping: db column  →  candidate Excel header aliases
    mapping = {
        "ptr_no":              ["No.", "ptr_no", "ptr", "document_no"],
        "transfer_order_no":   ["Transfer Order No.", "transfer_order_no", "transfer_order"],
        "transfer_from_code":  ["Transfer-from Code", "transfer_from_code", "from_code"],
        "transfer_to_code":    ["Transfer-to Code", "transfer_to_code", "to_code"],
        "posting_date":        ["Posting Date", "posting_date", "posted_date"],
        "shipment_date":       ["Shipment Date", "shipment_date", "ship_date"],
        "receipt_date":        ["Receipt Date", "receipt_date", "received_date"],
        "shipping_agent_code": ["Shipping Agent Code", "shipping_agent_code", "shipping_agent"],
    }

    mapped: dict[str, pd.Series] = {}
    for db_col, aliases in mapping.items():
        src = pick_column(df, aliases)
        if src is not None:
            mapped[db_col] = df[src]
        else:
            mapped[db_col] = pd.Series([pd.NA] * len(df))

    # --- convert date columns from Excel serial → YYYY-MM-DD ---
    for date_col in ["posting_date", "shipment_date", "receipt_date"]:
        mapped[date_col] = to_date_series(mapped[date_col])

    # --- auto-compute lead-time days ---
    def to_dt(s):
        return pd.to_datetime(s, errors="coerce")

    ship_dt = to_dt(mapped["shipment_date"])
    receipt_dt = to_dt(mapped["receipt_date"])
    posting_dt = to_dt(mapped["posting_date"])

    mapped["ship_to_receipt_days"] = (receipt_dt - ship_dt).dt.days
    mapped["receipt_to_posting_days"] = (posting_dt - receipt_dt).dt.days
    mapped["ship_to_posting_days"] = (posting_dt - ship_dt).dt.days

    # --- metadata columns ---
    mapped["source_file"] = excel_path
    mapped["import_period"] = datetime.now().strftime("%Y-%m")
    now = datetime.now().isoformat()
    mapped["created_at"] = now
    mapped["updated_at"] = now

    out = pd.DataFrame(mapped)
    out.to_csv(output_path, index=False)

    print(f"\n✅ Converted {len(out)} rows → {output_path}")
    print(f"   ptr_no non-null : {out['ptr_no'].notna().sum()}")
    print(f"   receipt_date OK : {out['receipt_date'].notna().sum()}")
    print("\nFirst 3 rows:")
    print(out.head(3).to_string())


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert_ptr_excel.py <input.xlsx> <output.csv>")
        sys.exit(1)
    map_excel_to_receiving_header(sys.argv[1], sys.argv[2])
