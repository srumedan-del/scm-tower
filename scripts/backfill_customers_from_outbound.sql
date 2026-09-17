-- Backfill Customer Master dari outbound_header
-- Tujuan: melengkapi customers.customer_code agar MTA Outbound dapat dihitung.
-- Jalankan di Supabase SQL Editor.
--
-- Catatan:
-- 1. customer_code adalah kunci pencocokan MTA.
-- 2. Script ini hanya mengambil customer_code yang belum ada di customers.
-- 3. Koordinat, mesin HD, dan stok tidak ditebak dari outbound; lengkapi dari menu Customer Master.

-- 1) Preview kandidat yang belum ada di Customer Master
WITH outbound_customers AS (
  SELECT
    NULLIF(BTRIM(customer_no), '') AS customer_code,
    MAX(NULLIF(BTRIM(customer_name), '')) AS customer_name,
    MAX(NULLIF(BTRIM(ship_to_city), '')) AS city
  FROM public.outbound_header
  WHERE NULLIF(BTRIM(customer_no), '') IS NOT NULL
  GROUP BY NULLIF(BTRIM(customer_no), '')
)
SELECT
  o.customer_code,
  o.customer_name,
  o.city,
  CASE
    WHEN UPPER(COALESCE(o.city, '')) IN ('ACEH', 'BANDA ACEH', 'LHOKSEUMAWE', 'LANGSA', 'MEDAN', 'BINJAI', 'PEMATANGSIANTAR', 'PEMATANG SIANTAR', 'TEBING TINGGI', 'DUMAI', 'PEKANBARU')
      THEN CASE
        WHEN UPPER(o.city) IN ('ACEH', 'BANDA ACEH', 'LHOKSEUMAWE', 'LANGSA') THEN 'LK'
        ELSE 'DK'
      END
    ELSE NULL
  END AS suggested_dk_lk
FROM outbound_customers o
LEFT JOIN public.customers c ON UPPER(BTRIM(c.customer_code)) = UPPER(o.customer_code)
WHERE c.id IS NULL
ORDER BY o.customer_code;

-- 2) Insert customer yang belum ada.
-- ON CONFLICT aman dijalankan ulang jika customer_code memiliki unique constraint.
WITH outbound_customers AS (
  SELECT
    NULLIF(BTRIM(customer_no), '') AS customer_code,
    MAX(NULLIF(BTRIM(customer_name), '')) AS customer_name,
    MAX(NULLIF(BTRIM(ship_to_city), '')) AS city
  FROM public.outbound_header
  WHERE NULLIF(BTRIM(customer_no), '') IS NOT NULL
  GROUP BY NULLIF(BTRIM(customer_no), '')
), missing_customers AS (
  SELECT o.*
  FROM outbound_customers o
  LEFT JOIN public.customers c ON UPPER(BTRIM(c.customer_code)) = UPPER(o.customer_code)
  WHERE c.id IS NULL
)
INSERT INTO public.customers (
  customer_code,
  customer_name,
  city,
  province,
  address,
  dk_lk,
  is_hd_customer,
  machine_count,
  stock_quantity,
  daily_usage,
  lead_time_days,
  safety_buffer_days,
  is_active
)
SELECT
  customer_code,
  COALESCE(customer_name, customer_code),
  COALESCE(city, 'BELUM DIISI'),
  CASE
    WHEN UPPER(COALESCE(city, '')) IN ('ACEH', 'BANDA ACEH', 'LHOKSEUMAWE', 'LANGSA') THEN 'Aceh'
    ELSE 'Sumatera Utara'
  END,
  NULL,
  CASE
    WHEN UPPER(COALESCE(city, '')) IN ('ACEH', 'BANDA ACEH', 'LHOKSEUMAWE', 'LANGSA') THEN 'LK'
    ELSE 'DK'
  END,
  false,
  0,
  0,
  0,
  3,
  2,
  true
FROM missing_customers
ON CONFLICT (customer_code) DO NOTHING;

-- 3) Validasi: customer outbound yang masih belum ada di master.
SELECT
  h.customer_no,
  MAX(h.customer_name) AS customer_name,
  COUNT(*) AS outbound_count
FROM public.outbound_header h
LEFT JOIN public.customers c
  ON UPPER(BTRIM(c.customer_code)) = UPPER(BTRIM(h.customer_no))
WHERE NULLIF(BTRIM(h.customer_no), '') IS NOT NULL
  AND c.id IS NULL
GROUP BY h.customer_no
ORDER BY h.customer_no;

-- 4) Setelah insert, cek customer baru yang masih perlu dilengkapi koordinat.
SELECT customer_code, customer_name, city, province, dk_lk, latitude, longitude
FROM public.customers
WHERE latitude IS NULL OR longitude IS NULL
ORDER BY customer_name;
