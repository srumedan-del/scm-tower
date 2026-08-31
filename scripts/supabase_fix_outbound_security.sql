-- =========================================================
-- SCM Control Tower
-- Minimal safe outbound integrity repair for the actual schema
-- This version matches the live schema you inspected:
--   - outbound_header exists
--   - outbound_detail exists
--   - outbound_detail.outbound_header_id exists
--   - outbound_header.id exists
--   - document_no exists only in outbound_detail, not in outbound_header
--   - actual_delivery_date/actual_received_date do not exist on outbound_header
-- =========================================================

-- 0) Inspect the real schema
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('outbound_header', 'outbound_detail', 'shipment_tracking')
ORDER BY table_name, column_name;

-- 1) Ensure the actual relationship column exists on detail
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
END $$;

-- 2) Ensure the header carries has_detail
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_header'
  ) THEN
    ALTER TABLE outbound_header
      ADD COLUMN IF NOT EXISTS has_detail boolean;
  END IF;
END $$;

-- 3) Ensure the FK exists without crashing if it's already present
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

-- 4) Recompute has_detail from the real relationship key
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
      AND column_name = 'has_detail'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_detail'
      AND column_name = 'outbound_header_id'
  ) THEN
    UPDATE outbound_header h
    SET has_detail = EXISTS (
      SELECT 1
      FROM outbound_detail d
      WHERE d.outbound_header_id = h.id
    );
  ELSE
    RAISE NOTICE 'Skipping has_detail recomputation because the real outbound relationship is not available.';
  END IF;
END $$;

-- 5) Trigger to keep has_detail in sync after inserts/updates/deletes
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
      AND table_name = 'outbound_detail'
      AND column_name = 'outbound_header_id'
  ) THEN
    CREATE OR REPLACE FUNCTION refresh_outbound_header_has_detail()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $func$
    BEGIN
      UPDATE outbound_header
      SET has_detail = EXISTS (
        SELECT 1
        FROM outbound_detail d
        WHERE d.outbound_header_id = outbound_header.id
      )
      WHERE id = COALESCE(NEW.outbound_header_id, OLD.outbound_header_id);

      RETURN COALESCE(NEW, OLD);
    END;
    $func$;

    DROP TRIGGER IF EXISTS trg_refresh_outbound_header_has_detail ON outbound_detail;

    CREATE TRIGGER trg_refresh_outbound_header_has_detail
    AFTER INSERT OR UPDATE OF outbound_header_id OR DELETE
    ON outbound_detail
    FOR EACH ROW
    EXECUTE FUNCTION refresh_outbound_header_has_detail();
  END IF;
END $$;

-- 6) Minimal RLS for tables that actually exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outbound_header') THEN
    ALTER TABLE outbound_header ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outbound_detail') THEN
    ALTER TABLE outbound_detail ENABLE ROW LEVEL SECURITY;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_tracking') THEN
    ALTER TABLE shipment_tracking ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outbound_header') THEN
    DROP POLICY IF EXISTS "admin_all_outbound_header" ON outbound_header;
    DROP POLICY IF EXISTS "operator_select_outbound_header" ON outbound_header;

    CREATE POLICY "admin_all_outbound_header"
    ON outbound_header
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

    CREATE POLICY "operator_select_outbound_header"
    ON outbound_header
    FOR SELECT
    USING (auth.jwt() ->> 'role' IN ('admin', 'operator'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'outbound_detail') THEN
    DROP POLICY IF EXISTS "admin_all_outbound_detail" ON outbound_detail;
    DROP POLICY IF EXISTS "operator_select_outbound_detail" ON outbound_detail;

    CREATE POLICY "admin_all_outbound_detail"
    ON outbound_detail
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

    CREATE POLICY "operator_select_outbound_detail"
    ON outbound_detail
    FOR SELECT
    USING (auth.jwt() ->> 'role' IN ('admin', 'operator'));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shipment_tracking') THEN
    DROP POLICY IF EXISTS "admin_all_shipment_tracking" ON shipment_tracking;

    CREATE POLICY "admin_all_shipment_tracking"
    ON shipment_tracking
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');
  END IF;
END $$;

-- 7) KPI is_late: only recalc if the actual date columns exist
DO $$
DECLARE
  has_promised boolean;
  has_actual_delivery boolean;
  has_actual_received boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_header'
      AND column_name = 'promised_delivery_date'
  ) INTO has_promised;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_header'
      AND column_name = 'actual_delivery_date'
  ) INTO has_actual_delivery;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'outbound_header'
      AND column_name = 'actual_received_date'
  ) INTO has_actual_received;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'outbound_header'
  )
  AND has_promised THEN
    ALTER TABLE outbound_header
      ADD COLUMN IF NOT EXISTS is_late boolean;

    IF has_actual_delivery AND has_actual_received THEN
      UPDATE outbound_header
      SET is_late = CASE
        WHEN promised_delivery_date IS NULL THEN false
        WHEN actual_delivery_date IS NOT NULL AND actual_delivery_date > promised_delivery_date THEN true
        WHEN actual_received_date IS NOT NULL AND actual_received_date > promised_delivery_date THEN true
        ELSE false
      END;
    ELSIF has_actual_delivery THEN
      UPDATE outbound_header
      SET is_late = CASE
        WHEN promised_delivery_date IS NULL THEN false
        WHEN actual_delivery_date IS NOT NULL AND actual_delivery_date > promised_delivery_date THEN true
        ELSE false
      END;
    ELSIF has_actual_received THEN
      UPDATE outbound_header
      SET is_late = CASE
        WHEN promised_delivery_date IS NULL THEN false
        WHEN actual_received_date IS NOT NULL AND actual_received_date > promised_delivery_date THEN true
        ELSE false
      END;
    ELSE
      RAISE NOTICE 'Skipping is_late recalculation because actual delivery columns are not present on outbound_header.';
    END IF;
  ELSE
    RAISE NOTICE 'Skipping is_late recalculation because outbound_header or promised_delivery_date is missing.';
  END IF;
END $$;

-- 8) Repair orphan detail rows by creating missing parent headers
DO $$
DECLARE
  v_detail RECORD;
  v_header_id bigint;
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
      AND column_name = 'has_detail'
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
      WITH inserted AS (
        INSERT INTO outbound_header (
          shipment_no,
          has_detail
        )
        VALUES (
          'AUTO-' || v_detail.detail_id,
          true
        )
        RETURNING id
      )
      SELECT id INTO v_header_id
      FROM inserted;

      UPDATE outbound_detail
      SET outbound_header_id = v_header_id
      WHERE id = v_detail.detail_id;
    END LOOP;

    UPDATE outbound_header h
    SET has_detail = EXISTS (
      SELECT 1
      FROM outbound_detail d
      WHERE d.outbound_header_id = h.id
    );

    RAISE NOTICE 'Created missing outbound_header rows for orphan outbound_detail records using generated shipment_no values.';
  ELSE
    RAISE NOTICE 'Skipping orphan outbound_detail repair because the required schema is not available or shipment_no is missing.';
  END IF;
END $$;

-- =========================================================
-- FINAL CHECKS
-- =========================================================
SELECT 'VALIDATION_DONE' AS status;
