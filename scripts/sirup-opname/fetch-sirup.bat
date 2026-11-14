@echo off
REM Dijalankan Task Scheduler tiap hari kerja pukul 07.00: ambil stok SIRUP dan simpan snapshot di SCM Tower.
REM Sesi stock opname dibuat pengguna dari menu Stock Opname -> Buat Opname.
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" fetch-sirup.cjs >> fetch-sirup-console.log 2>&1
