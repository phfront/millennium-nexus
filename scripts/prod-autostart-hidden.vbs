Dim shell
Dim fso
Dim scriptDir
Dim psScript
Dim command

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = fso.BuildPath(scriptDir, "prod-autostart.ps1")

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & psScript & """"
shell.CurrentDirectory = fso.GetParentFolderName(scriptDir)
shell.Run command, 0, False
