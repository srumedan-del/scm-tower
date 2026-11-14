-- v51: Stock Opname dibagi per periode (Harian, Mingguan, Bulanan).
-- Sesi yang sudah ada dianggap Mingguan.
alter table stock_opname_session
  add column if not exists period text not null default 'Mingguan';

alter table stock_opname_session drop constraint if exists stock_opname_session_period_check;
alter table stock_opname_session
  add constraint stock_opname_session_period_check check (period in ('Harian', 'Mingguan', 'Bulanan'));

create index if not exists stock_opname_session_period_date_idx on stock_opname_session (period, opname_date desc);
