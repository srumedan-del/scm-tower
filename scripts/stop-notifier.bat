@echo off
echo Menghentikan SCM Tower Background Notifier...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*task-notifier.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Layanan telah dihentikan.
pause
