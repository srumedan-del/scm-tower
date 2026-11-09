Set WshShell = CreateObject("WScript.Shell")
strCurrentDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
strProjectDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(strCurrentDir)

' Jalankan task-notifier.js secara tersembunyi (window style 0 = hidden)
WshShell.CurrentDirectory = strProjectDir
WshShell.Run "node scripts\task-notifier.js --daemon", 0, False
