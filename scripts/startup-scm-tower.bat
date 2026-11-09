@echo off
cd /d "D:\project\scm-tower"
echo [SCM TOWER STARTUP] Memulai server produksi...
REM Pastikan .env.local ada sebelum melanjutkan
if not exist ".env.local" (
    echo [WARNING] .env.local tidak ditemukan! Pastikan file sudah tersedia.
)
npm run build
npm start