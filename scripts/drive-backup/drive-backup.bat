@echo off
REM Dijalankan Task Scheduler: salin foto POD dan BBM dari server ke Google Drive (H:\My Drive\POD dan \BBM).
REM Log: scripts\drive-backup\drive-backup.log
cd /d "%~dp0\..\.."
call node_modules\.bin\tsx.cmd scripts\drive-backup\drive-backup.ts >> scripts\drive-backup\drive-backup-console.log 2>&1
