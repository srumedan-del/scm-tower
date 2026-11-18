# Dashboard Spec — SCM Tower (Order Fulfillment)

Disusun dengan skill `bi-dashboard-design` + `supply-chain-order-fulfillment-dashboard`,
disesuaikan dengan data SCM Tower (aplikasi web Next.js, bukan Power BI/Tableau/Looker).

```yaml
dashboard:
  id: scm_fulfillment
  title: Pengiriman & Fulfillment
  domain_skill: supply-chain-order-fulfillment-dashboard
  platform: web (Next.js SCM Tower, grafik recharts)
  audience: Owner / Kepala Gudang SRU Medan (L1)
  decisions:
    - Apakah pengiriman bulan ini memenuhi SLA (target OTIF 95%)?
    - Gagal di mana: terlambat, gagal kirim, atau belum dikirim?
    - Transporter mana yang di bawah target?
    - PSS mana yang harus ditindaklanjuti hari ini?
  refresh: setiap halaman dibuka (data live Supabase)
  unit: PSS / dokumen; biaya dalam Rupiah
  default_period: bulan berjalan (bisa pilih bulan lain)
  security: { row_level: none, sensitive_fields: [] }

data:
  source: Supabase (shipment_tracking, vw_shipment_tms, outbound_header, customers)
  facts:
    - name: Shipment PSS
      grain: satu baris per PSS/CD di shipment_tracking (setara "order line" di skill)
  dimensions: [Tanggal dokumen, Minggu, DK/LK, Transporter, Customer, Kota]
  assumptions:
    - Tanggal acuan (reference date) = jatuh tempo SLA: DK 1 hari kerja, LK 5 hari kerja dari
      jam dokumen dibuat; Sabtu-Minggu libur.
    - "In full": SCM Tower tidak mencatat kirim sebagian, jadi diganti "terkirim tanpa gagal
      kirim" (Failed Delivery = tidak in full).
    - PSS lewat jatuh tempo yang belum terkirim dihitung GAGAL (sesuai aturan skill).
    - PSS ongkos kirim (BIA-...) dikecualikan.

metrics:
  - OTIF %            # tepat waktu SLA DAN tanpa gagal kirim / PSS terukur. Naik = baik. Target 95%.
  - On-time %         # terkirim <= jatuh tempo SLA / PSS terukur. Naik = baik.
  - Delivery Success % # terkirim tanpa Failed Delivery / PSS terukur. Naik = baik.
  - Order Cycle Time  # median jam dokumen dibuat -> diterima customer (hari). Turun = baik.
  - Backlog PSS       # PSS belum dibuat shipment + shipment terbuka lewat SLA. Turun = baik.
  - Biaya per PSS     # total biaya kirim / PSS terkirim yang biayanya terisi. Turun = baik.

pages:
  - id: overview
    title: Pengiriman & Fulfillment
    tier: L1
    filters: [Periode bulan]
    rows:
      - - {component: kpi_card, metric: OTIF %, compare: target, target: 95, cols: 2}
        - {component: kpi_card, metric: On-time %, compare: prior_month, cols: 2}
        - {component: kpi_card, metric: Delivery Success %, compare: prior_month, cols: 2}
        - {component: kpi_card, metric: Order Cycle Time, compare: prior_month, cols: 2}
        - {component: kpi_card, metric: Backlog PSS, compare: prior_month, cols: 2}
        - {component: kpi_card, metric: Biaya per PSS, compare: prior_month, cols: 2}
      - - {component: trend_line, metric: [OTIF %, On-time %], by: Minggu, reference: target 95%, cols: 8, height: 4}
        - {component: stacked_bar, metric: PSS gagal, by: [Terlambat, Gagal kirim, Lewat SLA belum terkirim], cols: 4, height: 4}
      - - {component: ranked_bar, metric: OTIF %, by: Transporter, reference: target, cols: 6, height: 4}
        - {component: exception_table, title: "Perlu tindakan hari ini",
           columns: [PSS, Customer, DK/LK, Jatuh tempo, Status, Transporter],
           sort: jatuh tempo asc, rows: 7, cols: 6, height: 4}
    footer: definisi metrik (tooltip) · data per [jam buka halaman] · link ke Shipment
    drill_through: /shipment dan /outbound (halaman L3 yang sudah ada)

decisions_confirmed:   # owner, 18 Nov 2026
  - Crossdocking mepet deadline dan PTS belum diputuskan masuk tabel "Perlu tindakan" (kolom Jenis);
    kartu Receiving terbaru dihapus dari Dashboard.
  - Acuan tepat waktu = SLA DK/LK dalam hari kerja (bukan Promised Date NAV).
```

Catatan desain (dari `bi-dashboard-design`):
- Satu tier per halaman (L1), maksimal 8 visual: 6 kartu KPI + 2 grafik + 1 tabel pengecualian
  (kartu dihitung satu baris).
- Setiap KPI punya pembanding (target atau bulan lalu) dan arah "naik = baik" yang benar.
- Warna status (hijau/kuning/merah) hanya dipakai bila ada target; selalu disertai ikon/teks.
- Angka KPI tampil langsung (tanpa animasi menghitung naik), sesuai temuan audit animasi.
