-- v54: Status sesi stock opname mengikuti progres pengisian.
--   Draft           = belum ada lot yang diisi Qty Fisik
--   Sedang dihitung = sebagian lot sudah diisi
--   Selesai         = semua lot sudah diisi
--   Diverifikasi    = tetap (diatur terpisah)
alter table stock_opname_session drop constraint if exists stock_opname_session_status_check;

update stock_opname_session set status = 'Selesai' where status = 'Selesai dihitung';

-- Sesuaikan sesi yang sudah ada dengan progres pengisiannya.
update stock_opname_session s
set status = case
    when c.counted = 0 then 'Draft'
    when c.counted < c.total then 'Sedang dihitung'
    else 'Selesai'
  end
from (
  select session_id, count(*) as total, count(qty_physical) as counted
  from stock_opname_line
  group by session_id
) c
where c.session_id = s.id and s.status <> 'Diverifikasi';

alter table stock_opname_session
  add constraint stock_opname_session_status_check
  check (status in ('Draft', 'Sedang dihitung', 'Selesai', 'Diverifikasi'));
