@echo off
echo ========================================================
echo Mendaftarkan SCM Tower Background Notifier ke Windows Startup
echo ========================================================

set "TARGET_DIR=%~dp0"
set "PROJECT_DIR=%TARGET_DIR%.."
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_DIR%\ScmTowerNotifier.lnk"
set "VBS_SCRIPT=%TARGET_DIR%run-notifier-hidden.vbs"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_SCRIPT%\"'; $s.WorkingDirectory = '%PROJECT_DIR%'; $s.Save();"

if exist "%SHORTCUT_PATH%" (
    echo [SUKSES] Notifier berhasil didaftarkan ke Windows Startup!
    echo Layanan akan otomatis berjalan setiap komputer dinyalakan.
    echo.
    echo Menjalankan layanan sekarang di latar belakang...
    wscript.exe "%VBS_SCRIPT%"
    echo Selesai! Layanan pemantau aktif senyap di background.
) else (
    echo [GAGAL] Tidak dapat membuat shortcut di Startup folder.
)

pause
