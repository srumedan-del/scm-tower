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
        # Handle pandas Timestamp objects
        if hasattr(serial, 'year') and hasattr(serial, 'month') and hasattr(serial, 'day'):
            return serial.strftime("%Y-%m-%d")
        # Handle Excel serial numbers
        serial = float(serial)
        if serial < 1:
            return None
        # Excel epoch: 1899-12-30 (accounting for the 1900 leap-year bug)
        base = datetime(1899, 12, 30)
        return (base + timedelta(days=int(serial))).strftime("%Y-%m-%d")
    except (ValueError, OverflowError, TypeError):
        # Not a serial number — maybe already a date string
        try:
            return pd.to_datetime(serial).strftime("%Y-%m-%d")
        except Exception:
            return None

def to_date_series(series: pd.Series) -> pd.Series:
    """Convert a column that may contain Excel serial numbers or strings to date strings."""
    return series.apply(excel_serial_to_date)

def map_excel_to_receiving_detail(excel_path: str, output_path: str):
    df = pd.read_excel(excel_path)

    # --- debug: show raw Excel structure ---
    print("Excel columns:", df.columns.tolist())
    print("\nFirst 5 rows:")
    print(df.head().to_string())

    # Mapping: db column  →  candidate Excel header aliases
    # All columns that exist in receiving_detail table
    mapping = {
        "posting_date":            ["Posting Date", "posting_date", "posted_date"],
        "entry_type":              ["Entry Type", "entry_type"],
        "document_type":           ["Document Type", "document_type"],
        "document_no":             ["Document No.", "document_no", "doc_no", "ptr_no", "no"],
        "document_line_no":        ["Document Line No.", "document_line_no", "line_no", "doc_line_no"],
        "item_no":                 ["Item No.", "item_no", "sku", "item_no_1"],
        "variant_code":            ["Variant Code", "variant_code"],
        "description":             ["Description", "description", "item_name", "desc"],
        "document_created_at":     ["Document Created Date/Time", "document_created_datetime", "document_created_date_time", "created_date"],
        "branch_representative":   ["CABANG/PERWAKILAN", "cabang_perwakilan", "branch_representative", "branch", "cabang"],
        "project":                 ["PROJECT", "project"],
        "return_reason_code":      ["Return Reason Code", "return_reason_code"],
        "location_code":           ["Location Code", "location_code", "location", "loc"],
        "lot_no":                  ["Lot No.", "lot_no", "lot"],
        "expiration_date":         ["Expiration Date", "expiration_date", "expiry_date", "exp_date"],
        "serial_no":               ["Serial No.", "serial_no", "serial"],
        "quantity":                ["Quantity", "quantity", "qty"],
        "invoiced_quantity":       ["Invoiced Quantity", "invoiced_quantity", "invoiced_qty"],
        "remaining_quantity":      ["Remaining Quantity", "remaining_quantity", "remaining_qty"],
        "shipped_qty_not_returned": ["Shipped Qty. Not Returned", "shipped_qty_not_returned", "shipped_not_returned"],
        "reserved_quantity":       ["Reserved Quantity", "reserved_quantity", "reserved_qty"],
        "open":                    ["Open", "open"],
        "order_type":              ["Order Type", "order_type"],
        "entry_no":                ["Entry No.", "entry_no"],
    }

    mapped: dict[str, pd.Series] = {}
    for db_col, aliases in mapping.items():
        src = pick_column(df, aliases)
        if src is not None:
            mapped[db_col] = df[src]
        else:
            mapped[db_col] = pd.Series([pd.NA] * len(df))

    # --- convert date columns from Excel serial → YYYY-MM-DD ---
    for date_col in ["posting_date", "expiration_date", "document_created_at"]:
        mapped[date_col] = to_date_series(mapped[date_col])

    # --- fill empty Expiration Date with 9999-12-31 ---
    mapped["expiration_date"] = mapped["expiration_date"].fillna("9999-12-31")

    # --- metadata columns ---
    mapped["source_file"] = excel_path
    mapped["import_period"] = datetime.now().strftime("%Y-%m")
    now = datetime.now().isoformat()
    mapped["created_at"] = now
    mapped["updated_at"] = now

    out = pd.DataFrame(mapped)
    out.to_csv(output_path, index=False)

    print(f"\n✅ Converted {len(out)} rows → {output_path}")
    print(f"   document_no non-null : {out['document_no'].notna().sum()}")
    print(f"   item_no non-null : {out['item_no'].notna().sum()}")
    print(f"   expiration_date non-null : {out['expiration_date'].notna().sum()}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python convert_ptr_detail_excel.py <input_excel> <output_csv>")
        sys.exit(1)
    map_excel_to_receiving_detail(sys.argv[1], sys.argv[2])