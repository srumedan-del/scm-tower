import csv, os, sys
from pathlib import Path

def generate_or_load_data():
    # Look for output_detail.csv in project root
    project_root = Path(__file__).resolve().parent
    input_path = project_root / "output_detail.csv"
    if input_path.exists():
        print(f"Loading outbound data from {input_path}")
        with open(input_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            headers = next(reader)
            rows = list(reader)
        return headers, rows
    else:
        # Fallback: generate synthetic data matching outbound_detail schema
        print(f"Generating synthetic outbound data (no file found at {input_path})")
        # We'll mimic the header from receiving_detail, adjust doc_no and types
        headers = [
            "id", "entry_no", "posting_date", "entry_type", "document_type",
            "document_no", "document_line_no", "item_no", "variant_code",
            "description", "document_created_at", "branch_representative",
            "project", "return_reason_code", "location_code", "lot_no",
            "expiration_date", "serial_no", "quantity", "invoiced_quantity",
            "remaining_quantity", "shipped_qty_not_returned",
            "reserved_quantity", "open", "order_type", "qty_out", "qty_in",
            "is_sale", "source_file", "import_period", "created_at", "updated_at"
        ]
        rows = []
        # Create rows based on prefix "PSS"
        for i in range(50):
            rows.append([
                str(i + 1),
                str(3465000 + i),
                f"2026-09-{22 + (i % 10):02d}",  # dates within range
                "Sale",
                "Sales Shipment",
                f"PSS-2609-{200 + i}",
                "20000",
                f"DS03L2332R-N",
                "",
                f"Item {i}",
                f"2026-09-{22 + (i % 10):02d}T10:00:00",
                "CAB01-JKT",
                "NON-PROJECT",
                "",
                "MDN-PAR",
                f"LOT-{i:04d}",
                f"2027-12-{31 - (i % 30):02d}",
                "",
                str(500 + (i * 10)),
                "",
                "",
                "",
                "",
                "",
                "True",
                "Transfer",
                str(500 + (i * 10)),
                "0",
                "True",
                "outbound_data.csv",
                "2026-09",
                "2026-09-04T00:00:00",
                "2026-09-04T00:00:00"
            ])
        return headers, rows


def main():
    headers, rows = generate_or_load_data()
    # Filter by location_code = MDN-PAR (already satisfied)
    filtered = [r for r in rows if r[14] == "MDN-PAR"]
    # Optionally filter by document_type in Sales Shipment / Assembly
    # We already set document_type column index 5 (0‑based) = Sales Shipment or Assembly
    # Let's just accept all rows in this sample

    # Write to workspace CSV
    out_path = Path.cwd() / "outbound_detail.csv"
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(filtered)

    print(f"✅ Generated {len(filtered)} outbound_detail rows at {out_path}")
    # Show a sample
    print("\n--- Sample rows ---")
    for r in filtered[:5]:
        print(f"  Document No: {r[5]}, Item: {r[8]}, Qty: {r[16]}, Type: {r[4]}")

if __name__ == "__main__":
    main()