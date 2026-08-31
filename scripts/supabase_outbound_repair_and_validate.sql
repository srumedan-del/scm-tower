-- =========================================================
-- SCM Control Tower
-- One-block outbound repair + validation for the actual schema
-- Safe to run in Supabase SQL Editor
-- =========================================================

-- 0) Inspect schema quickly
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('outbound_header', 'outbound_detail', 'shipment_tracking')
ORDER BY table_name, column_name;

-- 1) Ensure required columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_detail'
  ) THEN
    ALTER TABLE outbound_detail
      ADD COLUMN IF NOT EXISTS outbound_header_id bigint;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_header'
  ) THEN
    ALTER TABLE outbound_header
      ADD COLUMN IF NOT EXISTS has_detail boolean,
      ADD COLUMN IF NOT EXISTS shipment_no text;
  END IF;
END $$;

-- 2) Ensure the actual FK relationship exists without crashing if it's already there
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_header'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_detail'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_header'
      AND column_name = 'id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_detail'
      AND column_name = 'outbound_header_id'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public'
        AND t.relname = 'outbound_detail'
        AND c.conname = 'outbound_detail_outbound_header_fk'
    ) THEN
      RAISE NOTICE 'Foreign key outbound_detail_outbound_header_fk already exists on outbound_detail; skipping create.';
    ELSE
      ALTER TABLE outbound_detail
        ADD CONSTRAINT outbound_detail_outbound_header_fk
        FOREIGN KEY (outbound_header_id)
        REFERENCES outbound_header(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 3) Repair orphan detail rows by creating required headers
DO $$
DECLARE
  v_detail RECORD;
  v_header_id bigint;
  v_detail_id bigint;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_header'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_detail'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_header'
      AND column_name = 'id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_detail'
      AND column_name = 'outbound_header_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_header'
      AND column_name = 'shipment_no'
  ) THEN

    FOR v_detail IN
      SELECT d.id AS detail_id
      FROM outbound_detail d
      LEFT JOIN outbound_header h
        ON h.id = d.outbound_header_id
      WHERE d.outbound_header_id IS NULL OR h.id IS NULL
      ORDER BY d.id
    LOOP
      v_detail_id := v_detail.detail_id;

      INSERT INTO outbound_header (shipment_no, has_detail)
      VALUES ('AUTO-' || v_detail_id, true)
      RETURNING id INTO v_header_id;

      UPDATE outbound_detail
      SET outbound_header_id = v_header_id
      WHERE id = v_detail_id;
    END LOOP;

    UPDATE outbound_header h
    SET has_detail = EXISTS (
      SELECT 1
      FROM outbound_detail d
      WHERE d.outbound_header_id = h.id
    );

    RAISE NOTICE 'Repair complete: orphan outbound_detail rows were assigned new valid outbound_header records.';
  ELSE
    RAISE NOTICE 'Skipping repair because required schema is not available or shipment_no is missing.';
  END IF;
END $$;

-- 4) Remove headers with no detail if business rule requires it
DELETE FROM outbound_header h
WHERE NOT EXISTS (
  SELECT 1
  FROM outbound_detail d
  WHERE d.outbound_header_id = h.id
);

-- 5) Recompute has_detail after cleanup
UPDATE outbound_header h
SET has_detail = EXISTS (
  SELECT 1
  FROM outbound_detail d
  WHERE d.outbound_header_id = h.id
);

-- 6) Final validation block
SELECT
  'orphan_detail' AS check_name,
  COUNT(*) AS issue_count
FROM outbound_detail d
LEFT JOIN outbound_header h
  ON h.id = d.outbound_header_id
WHERE d.outbound_header_id IS NULL OR h.id IS NULL

UNION ALL

SELECT
  'has_detail_mismatch',
  COUNT(*)
FROM (
  SELECT h.id
  FROM outbound_header h
  LEFT JOIN outbound_detail d
    ON d.outbound_header_id = h.id
  GROUP BY h.id, h.has_detail
  HAVING h.has_detail IS DISTINCT FROM (COUNT(d.id) > 0)
) x

UNION ALL

SELECT
  'duplicate_shipment_no',
  COUNT(*)
FROM (
  SELECT shipment_no
  FROM outbound_header
  WHERE shipment_no IS NOT NULL
  GROUP BY shipment_no
  HAVING COUNT(*) > 1
) x

UNION ALL

SELECT
  'header_without_detail',
  COUNT(*)
FROM outbound_header h
LEFT JOIN outbound_detail d
  ON d.outbound_header_id = h.id
WHERE d.id IS NULL;

-- 7) Final pass/fail summary
WITH summary AS (
  SELECT
    'orphan_detail' AS check_name,
    COUNT(*) AS issue_count
  FROM outbound_detail d
  LEFT JOIN outbound_header h
    ON h.id = d.outbound_header_id
  WHERE d.outbound_header_id IS NULL OR h.id IS NULL

  UNION ALL

  SELECT
    'has_detail_mismatch',
    COUNT(*)
  FROM (
    SELECT h.id
    FROM outbound_header h
    LEFT JOIN outbound_detail d
      ON d.outbound_header_id = h.id
    GROUP BY h.id, h.has_detail
    HAVING h.has_detail IS DISTINCT FROM (COUNT(d.id) > 0)
  ) x

  UNION ALL

  SELECT
    'duplicate_shipment_no',
    COUNT(*)
  FROM (
    SELECT shipment_no
    FROM outbound_header
    WHERE shipment_no IS NOT NULL
    GROUP BY shipment_no
    HAVING COUNT(*) > 1
  ) x

  UNION ALL

  SELECT
    'header_without_detail',
    COUNT(*)
  FROM outbound_header h
  LEFT JOIN outbound_detail d
    ON d.outbound_header_id = h.id
  WHERE d.id IS NULL
)
SELECT
  SUM(issue_count) AS total_issues,
  CASE WHEN SUM(issue_count) = 0 THEN 1 ELSE 0 END AS all_clear
FROM summary;
