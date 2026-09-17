-- SCM Control Tower v1.8: SKU packaging data and PSS load summary
-- Additive migration. Run in Supabase SQL Editor before importing MASTER VOLUME.

ALTER TABLE public.master_sku
  ADD COLUMN IF NOT EXISTS inner_length_cm numeric,
  ADD COLUMN IF NOT EXISTS inner_width_cm numeric,
  ADD COLUMN IF NOT EXISTS inner_height_cm numeric,
  ADD COLUMN IF NOT EXISTS outer_length_cm numeric,
  ADD COLUMN IF NOT EXISTS outer_width_cm numeric,
  ADD COLUMN IF NOT EXISTS outer_height_cm numeric,
  ADD COLUMN IF NOT EXISTS outer_box_cbm numeric,
  ADD COLUMN IF NOT EXISTS pcs_per_inner_box numeric,
  ADD COLUMN IF NOT EXISTS inner_boxes_per_outer_box numeric,
  ADD COLUMN IF NOT EXISTS pcs_per_outer_box numeric,
  ADD COLUMN IF NOT EXISTS outer_boxes_per_layer numeric,
  ADD COLUMN IF NOT EXISTS stack_count numeric,
  ADD COLUMN IF NOT EXISTS outer_boxes_per_pallet numeric,
  ADD COLUMN IF NOT EXISTS pcs_per_pallet numeric,
  ADD COLUMN IF NOT EXISTS outer_box_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS packaging_status text,
  ADD COLUMN IF NOT EXISTS volume_source text,
  ADD COLUMN IF NOT EXISTS volume_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS master_sku_volume_code_idx
  ON public.master_sku (sku_code);

COMMENT ON COLUMN public.master_sku.outer_box_cbm IS 'Outer carton volume in cubic meters.';
COMMENT ON COLUMN public.master_sku.outer_box_weight_kg IS 'Weight of one outer carton in kilograms.';
COMMENT ON COLUMN public.master_sku.pcs_per_outer_box IS 'Units in one outer carton.';
COMMENT ON COLUMN public.master_sku.packaging_status IS 'Aktif, Non Aktif, or Tidak Lengkap from packaging master.';

CREATE OR REPLACE VIEW public.vw_pss_load_summary AS
WITH detail_load AS (
  SELECT
    d.document_no AS pss_no,
    d.item_no AS sku_code,
    COALESCE(NULLIF(d.qty_out, 0), ABS(d.quantity), 0)::numeric AS quantity,
    s.sku_code IS NULL AS sku_missing,
    CASE
      WHEN s.pcs_per_outer_box IS NULL OR s.pcs_per_outer_box <= 0 THEN NULL
      ELSE CEIL(COALESCE(NULLIF(d.qty_out, 0), ABS(d.quantity), 0)::numeric / s.pcs_per_outer_box)
    END AS koli,
    CASE
      WHEN s.pcs_per_outer_box IS NULL OR s.pcs_per_outer_box <= 0 OR s.outer_box_weight_kg IS NULL THEN NULL
      ELSE s.outer_box_weight_kg / s.pcs_per_outer_box * COALESCE(NULLIF(d.qty_out, 0), ABS(d.quantity), 0)::numeric
    END AS weight_kg,
    CASE
      WHEN s.pcs_per_outer_box IS NULL OR s.pcs_per_outer_box <= 0
        OR s.outer_length_cm IS NULL OR s.outer_width_cm IS NULL OR s.outer_height_cm IS NULL THEN NULL
      ELSE (s.outer_length_cm * s.outer_width_cm * s.outer_height_cm / 4000) *
        (COALESCE(NULLIF(d.qty_out, 0), ABS(d.quantity), 0)::numeric / s.pcs_per_outer_box)
    END AS volumetric_ground_kg,
    CASE
      WHEN s.pcs_per_outer_box IS NULL OR s.pcs_per_outer_box <= 0
        OR s.outer_length_cm IS NULL OR s.outer_width_cm IS NULL OR s.outer_height_cm IS NULL THEN NULL
      ELSE (s.outer_length_cm * s.outer_width_cm * s.outer_height_cm / 6000) *
        (COALESCE(NULLIF(d.qty_out, 0), ABS(d.quantity), 0)::numeric / s.pcs_per_outer_box)
    END AS volumetric_air_kg,
    CASE
      WHEN s.outer_box_cbm IS NULL OR s.pcs_per_outer_box IS NULL OR s.pcs_per_outer_box <= 0 THEN NULL
      ELSE s.outer_box_cbm * CEIL(COALESCE(NULLIF(d.qty_out, 0), ABS(d.quantity), 0)::numeric / s.pcs_per_outer_box)
    END AS volume_cbm
  FROM public.outbound_detail d
  LEFT JOIN public.master_sku s
    ON upper(trim(s.sku_code)) = upper(trim(d.item_no))
)
SELECT
  pss_no,
  SUM(quantity) AS total_quantity,
  SUM(koli) AS total_koli,
  SUM(weight_kg) AS total_weight_kg,
  SUM(weight_kg) / 1000 AS total_tonnage,
  SUM(volumetric_ground_kg) AS total_volumetric_ground_kg,
  SUM(volumetric_air_kg) AS total_volumetric_air_kg,
  SUM(volume_cbm) AS total_volume_cbm,
  COUNT(*) FILTER (WHERE sku_missing) AS missing_sku_count,
  COUNT(*) FILTER (WHERE weight_kg IS NULL OR volume_cbm IS NULL) AS incomplete_load_count,
  COUNT(*) AS detail_count
FROM detail_load
GROUP BY pss_no;

COMMENT ON VIEW public.vw_pss_load_summary IS
  'PSS load totals derived from outbound_detail and versioned master_sku packaging data.';