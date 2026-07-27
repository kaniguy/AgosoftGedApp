' Demarre AgosoftGed en silence au login Windows (pas de fenetre console).
' Sur PC ARM : utilise docker-compose.arm.yml (Azure SQL Edge).
Option Explicit

Dim shell, fso, projectDir, composeFile, armFile, markerFile
Dim deadline, ready, arch, useArm, cmd

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
composeFile = projectDir & "\docker-compose.yml"
armFile = projectDir & "\docker-compose.arm.yml"
markerFile = projectDir & "\.agosoftged-arm"

If Not fso.FileExists(composeFile) Then
  WScript.Quit 1
End If

' Detecter PC ARM (ou marqueur cree par lancer-pc-arm.bat)
arch = UCase(shell.ExpandEnvironmentStrings("%PROCESSOR_ARCHITECTURE%"))
useArm = False
If arch = "ARM64" Or Left(arch, 3) = "ARM" Then useArm = True
If fso.FileExists(markerFile) And fso.FileExists(armFile) Then useArm = True
If useArm And Not fso.FileExists(armFile) Then useArm = False

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
If useArm Then
  cmd = "cmd /c docker compose -f docker-compose.yml -f docker-compose.arm.yml up -d >nul 2>&1"
Else
  cmd = "cmd /c docker compose up -d >nul 2>&1"
End If
shell.Run cmd, 0, True
WScript.Quit 0
