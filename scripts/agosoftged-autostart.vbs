' Demarre AgosoftGed en silence au login Windows (pas de fenetre console).
' SQL Server = instance Windows locale (hors Docker).
Option Explicit

Dim shell, fso, projectDir, composeFile
Dim deadline, ready

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
composeFile = projectDir & "\docker-compose.yml"

If Not fso.FileExists(composeFile) Then
  WScript.Quit 1
End If

' Attendre Docker Desktop (jusqu'a ~3 minutes)
deadline = DateAdd("n", 3, Now)
ready = False
Do While Now < deadline
  If shell.Run("cmd /c docker info >nul 2>&1", 0, True) = 0 Then
    ready = True
    Exit Do
  End If
  WScript.Sleep 5000
Loop

If Not ready Then
  WScript.Quit 2
End If

shell.CurrentDirectory = projectDir
shell.Run "cmd /c docker compose up -d >nul 2>&1", 0, True
WScript.Quit 0
