"""normalize_outbound_detail.py

Membersihkan file outbound_details (NAV Item Ledger Entries) sebelum
dimasukkan ke database.

MASALAH:
  Kolom `Document No.` kadang berisi nomor PAO (Purchase Adjustment Order)
  yang muncul di antara baris PSS. Baris PAO ini harus di-remap ke nomor
  PSS yang paling dekat (cari ke atas dulu, lalu ke bawah).

CARA PAKAI:
  python normalize_outbound_detail.py input.xlsx
  python normalize_outbound_detail.py input.xlsx output.xlsx
  python normalize_outbound_detail.py input.csv output.csv

  # Lihat preview tanpa simpan file:
  python normalize_outbound_detail.py input.xlsx --preview

DEPENDENCY:
  pip install pandas openpyxl
"""

import sys
import argparse
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("❌  pandas belum terinstall. Jalankan: pip install pandas openpyxl")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# KONFIGURASI — sesuaikan jika prefix berbeda di data Anda
# ─────────────────────────────────────────────────────────────────────────────
PSS_PREFIXES = ("PSS",)   # prefix nomor PSS yang valid (keep)
PAO_PREFIXES = ("PAO",)   # prefix yang akan di-remap ke PSS terdekat

DOC_NO_COL   = "Document No."   # nama kolom di file Excel/CSV


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def is_pss(val: str) -> bool:
    v = str(val).strip().upper()
    return any(v.startswith(p) for p in PSS_PREFIXES)


def is_pao(val: str) -> bool:
    v = str(val).strip().upper()
    return any(v.startswith(p) for p in PAO_PREFIXES)


def find_nearest_pss(series: "pd.Series", idx: int) -> str | None:
    """Cari PSS terdekat dari posisi idx.
    
    Strategi: cari ke atas (backward) dulu karena PAO biasanya
    mengikuti PSS induknya. Kalau tidak ada, cari ke bawah.
    """
    values = series.tolist()
    n = len(values)

    # Cari ke atas
    for i in range(idx - 1, -1, -1):
        if is_pss(str(values[i])):
            return str(values[i]).strip()

    # Cari ke bawah
    for i in range(idx + 1, n):
        if is_pss(str(values[i])):
            return str(values[i]).strip()

    return None


# ─────────────────────────────────────────────────────────────────────────────
# CORE LOGIC
# ─────────────────────────────────────────────────────────────────────────────

def find_doc_col(df: pd.DataFrame) -> str:
    """Cari kolom Document No. secara case-insensitive."""
    # Cek exact match dulu
    if DOC_NO_COL in df.columns:
        return DOC_NO_COL

    # Fuzzy: strip spasi, titik, lowercase
    def normalize_col(c: str) -> str:
        return c.strip().lower().replace(" ", "").replace(".", "")

    target = normalize_col(DOC_NO_COL)
    for col in df.columns:
        if normalize_col(col) == target:
            return col

    raise ValueError(
        f"Kolom '{DOC_NO_COL}' tidak ditemukan.\n"
        f"Kolom yang tersedia: {list(df.columns)}"
    )


def normalize(df: pd.DataFrame, verbose: bool = True) -> pd.DataFrame:
    df = df.copy()
    col = find_doc_col(df)

    doc_series = df[col].fillna("").astype(str)

    remapped   = []   # [(idx, original_pao, replacement_pss)]
    unmapped   = []   # [(idx, original_pao)]

    for idx in range(len(doc_series)):
        val = doc_series.iloc[idx]
        if not is_pao(val):
            continue

        replacement = find_nearest_pss(doc_series, idx)
        if replacement:
            remapped.append((idx, val.strip(), replacement))
            df.at[df.index[idx], col] = replacement
        else:
            unmapped.append((idx, val.strip()))

    if verbose:
        print(f"\n{'─'*60}")
        print(f"  Kolom yang diproses   : '{col}'")
        print(f"  Total baris           : {len(df)}")
        print(f"  Baris PAO ditemukan   : {len(remapped) + len(unmapped)}")
        print(f"  Berhasil di-remap     : {len(remapped)}")
        print(f"  Gagal (tidak ada PSS) : {len(unmapped)}")

        if remapped:
            print(f"\n  Contoh remap (maks 10):")
            for row_idx, pao, pss in remapped[:10]:
                print(f"    Row {row_idx+2:>5}  {pao:<20} → {pss}")
            if len(remapped) > 10:
                print(f"    ... dan {len(remapped)-10} baris lainnya")

        if unmapped:
            print(f"\n  ⚠  PAO yang TIDAK berhasil di-remap:")
            for row_idx, pao in unmapped:
                print(f"    Row {row_idx+2:>5}  {pao}")

        print(f"{'─'*60}\n")

    return df


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def read_file(path: Path) -> pd.DataFrame:
    ext = path.suffix.lower()
    if ext in (".xlsx", ".xls"):
        return pd.read_excel(path, dtype=str)
    elif ext == ".csv":
        return pd.read_csv(path, dtype=str)
    else:
        print(f"❌  Format tidak didukung: {ext}")
        print("    Gunakan .xlsx, .xls, atau .csv")
        sys.exit(1)


def write_file(df: pd.DataFrame, path: Path) -> None:
    ext = path.suffix.lower()
    if ext == ".csv":
        df.to_csv(path, index=False)
    else:
        df.to_excel(path, index=False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Remap nomor PAO → nomor PSS terdekat di kolom Document No."
    )
    parser.add_argument("input",  help="File input (.xlsx / .xls / .csv)")
    parser.add_argument("output", nargs="?", help="File output (opsional)")
    parser.add_argument(
        "--preview", action="store_true",
        help="Tampilkan preview tanpa menyimpan file output"
    )
    parser.add_argument(
        "--pss-prefix", nargs="+", default=list(PSS_PREFIXES),
        help=f"Prefix PSS (default: {PSS_PREFIXES})"
    )
    parser.add_argument(
        "--pao-prefix", nargs="+", default=list(PAO_PREFIXES),
        help=f"Prefix PAO (default: {PAO_PREFIXES})"
    )
    args = parser.parse_args()

    # Override prefix dari argumen CLI jika disediakan
    global PSS_PREFIXES, PAO_PREFIXES
    PSS_PREFIXES = tuple(p.upper() for p in args.pss_prefix)
    PAO_PREFIXES = tuple(p.upper() for p in args.pao_prefix)

    in_path = Path(args.input)
    if not in_path.exists():
        print(f"❌  File tidak ditemukan: {in_path}")
        sys.exit(1)

    out_path = (
        Path(args.output)
        if args.output
        else in_path.with_stem(in_path.stem + "_normalized")
    )

    print(f"Input : {in_path}")
    if not args.preview:
        print(f"Output: {out_path}")

    df = read_file(in_path)
    df_normalized = normalize(df, verbose=True)

    if args.preview:
        print("(Mode preview — file output tidak disimpan)")
        return

    write_file(df_normalized, out_path)
    print(f"✅  File tersimpan: {out_path}")


if __name__ == "__main__":
    main()
