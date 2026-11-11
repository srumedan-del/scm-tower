@echo off
rem Dijalankan oleh Windows Task Scheduler. Mengisi Laporan Tracking Pengiriman dari SCM Tower.
cd /d "%~dp0"
node update-laporan.cjs %*
