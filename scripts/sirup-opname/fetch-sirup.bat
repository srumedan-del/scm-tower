@echo off
REM Dijalankan Task Scheduler tiap hari kerja pukul 07.00: ambil stok SIRUP dan buat sesi stock opname SCM Tower.
REM Harian setiap hari kerja, ditambah Mingguan pada hari Jumat. Sabtu, Minggu, dan hari libur dilewati oleh script.
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" fetch-sirup.cjs >> fetch-sirup-console.log 2>&1
