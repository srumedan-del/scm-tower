@echo off
REM Pemantau tombol "Update dari NAV" di SCM Tower. Dimulai Task Scheduler saat Windows login (tanpa jendela).
cd /d "%~dp0\..\.."
"C:\Program Files\nodejs\node.exe" node_modules\tsx\dist\cli.mjs scripts\nav-sync\nav-sync-watch.ts >> scripts\nav-sync\nav-sync-watch-console.log 2>&1
