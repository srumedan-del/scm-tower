@echo off
REM Dijalankan Task Scheduler: ambil PSS, PTR dan ILE (MDN-PAR, 7 hari terakhir) dari web NAV ke SCM Tower.
REM Log: scripts\nav-sync\nav-sync.log. File Excel NAV diarsip di D:\nav\<tanggal>\.
cd /d "%~dp0\..\.."
call node_modules\.bin\tsx.cmd scripts\nav-sync\nav-sync.ts >> scripts\nav-sync\nav-sync-console.log 2>&1
