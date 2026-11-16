' Jalankan file .bat tanpa jendela (dipakai Task Scheduler untuk nav-sync).
' Pemakaian: wscript.exe run-hidden.vbs nama-file.bat
Set shell = CreateObject("WScript.Shell")
folder = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run """" & folder & "\" & WScript.Arguments(0) & """", 0, True
