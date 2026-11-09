-- v40: batas percobaan PIN driver.
-- 5 kali salah berturut-turut mengunci login driver selama 15 menit (nilai batas
-- dikirim dari lib/driver-service.ts). Admin yang mengganti PIN juga membuka kunci.

ALTER TABLE master_driver
  ADD COLUMN IF NOT EXISTS pin_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz;

-- Penambahan hitungan dilakukan dalam satu UPDATE agar percobaan yang datang
-- bersamaan tidak saling menimpa.
CREATE OR REPLACE FUNCTION record_driver_pin_failure(p_driver_id bigint, p_max_attempts integer, p_lock_minutes integer)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE master_driver
  SET
    pin_failed_attempts = CASE WHEN pin_failed_attempts + 1 >= p_max_attempts THEN 0 ELSE pin_failed_attempts + 1 END,
    pin_locked_until = CASE WHEN pin_failed_attempts + 1 >= p_max_attempts THEN now() + make_interval(mins => p_lock_minutes) ELSE pin_locked_until END
  WHERE id = p_driver_id;
$$;

REVOKE ALL ON FUNCTION record_driver_pin_failure(bigint, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_driver_pin_failure(bigint, integer, integer) TO service_role;

-- Muat ulang cache skema PostgREST agar fungsi baru langsung bisa dipanggil.
NOTIFY pgrst, 'reload schema';
