@echo off
REM Dijalankan Task Scheduler: ambil stok SIRUP dan buat sesi stock opname SCM Tower.
cd /d "%~dp0"
node fetch-sirup.cjs >> fetch-sirup-console.log 2>&1
