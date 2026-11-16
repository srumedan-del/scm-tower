-- v57: Jenis PTR. "koreksi" = PTR koreksi/pembatalan atas PTS yang salah, bukan pengiriman dari cabang lain.
-- PTR koreksi tetap tampil di Receiving (badge Koreksi) tetapi tidak dihitung di lead time dan jumlah inbound.
alter table receiving_header
  add column if not exists ptr_type text not null default 'pengiriman',
  add column if not exists ptr_note text;

do $$ begin
  alter table receiving_header add constraint receiving_header_ptr_type_check check (ptr_type in ('pengiriman', 'koreksi'));
exception when duplicate_object then null; end $$;
