-- ============================================================================
-- Add 'group' column to master_sku + backfill from Sheet3
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Step 1: Add column if not exists
ALTER TABLE public.master_sku
  ADD COLUMN IF NOT EXISTS "group" text;

-- Step 2: Create index for filter performance
CREATE INDEX IF NOT EXISTS master_sku_group_idx ON public.master_sku ("group");

-- Step 3: Backfill group values from Sheet3 (90 SKU)
-- Format: [NHD] and [HD] groups (Non-HD and HD products)

-- NHD group (66 SKU) - Non-HD products
UPDATE public.master_sku SET "group" = 'NHD' WHERE sku_code IN (
  '7022V PDM-12-PINK', '7022V PDM-13-BLUE', '7701-49 PDL-PBLUE', '7702-49 PDL-PPINK',
  '7751-12-PDO-PINK', '7751-13-PDO-B', '7751T-PDO-13-BLUE',
  '8620D-33-PDO', '8620F-14-PDO', '8620L-37-PDO',
  'AP120T-12', 'AP120T-12-RSAM', 'AP120T-18', 'AP120T-18-RSAM',
  'CSR-MDN-BAJUAPD-66', 'CSR-MDN-BAJUAPD-75',
  'IA-N-3500', 'IA-N-3502', 'IA-N-3503', 'IA-N-3504', 'IA-N-3505',
  'JM-ACSWAB-ISOPRO70',
  'LDT-2.1-1-4B', 'LDT-2.1-1-4W', 'LDT-2.1W', 'LDT-2.2-3-8B', 'LDT-2.2-3-8W',
  'NIC1650-N', 'NIC1832-N', 'NIC1832-N-E', 'NIC1850-N', 'NIC1850-N-E',
  'NIC2025-N', 'NIC2025-N-E', 'NIC2032-N', 'NIC2032-N-E',
  'NIC2225-N', 'NIC2225-N-E', 'NIC2420-N', 'NIC2420-N-E',
  'NIC2425-N', 'NIC2425-N-E',
  'NS2332',
  'PD225W-DT-PDA',
  'PR-325104-50ST', 'PR-325278-KIT',
  'PTMC-26',
  'SFE05', 'SFE07', 'SFE09',
  'W-CATH-1832-N-E', 'W-CATH-2032', 'W-CATH-2032-N-E',
  'W-CATH-2225', 'W-CATH-2225-N-E', 'W-CATH-2425-N-E',
  'IS-001A-NIJ',
  'IF110-18', 'IF110T-12', 'IF110T-12-RSAM',
  'A133-V702',
  'FB50G',
  'BL28G-NPR',
  'AK10L', 'AT10L'
);

-- HD group (22 SKU) - HD products (dialysis, HD set, etc)
UPDATE public.master_sku SET "group" = 'HD' WHERE sku_code IN (
  'AVF1625-HC-N', 'AVF1632-HC-N',
  'AK1-10L',
  'FG-SC-002',
  'HD PACK 3F', 'HD PACK-1B', 'HD PACK-2B', 'HD PACK-2C',
  'DS01T2613', 'DS01T2613R-N',
  'DS03L2332R-N', 'DS03L2425R-N',
  'DS05L2238R-N', 'DS10L2138R-N',
  'DS20LS', 'DS20LSR-N',
  'DS50CT-R-N', 'DS50LS-R-N',
  'ELISIO1-13H', 'ELISIO1-15H', 'ELISIO1-17H',
  'ELISIO-11H', 'ELISIO-15HX', 'ELISIO-17HX',
  'A016-R-V604R'
);

-- Step 4: Verify
SELECT "group", COUNT(*) as cnt
FROM public.master_sku
GROUP BY "group"
ORDER BY "group";