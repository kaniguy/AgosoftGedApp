@echo off
REM ============================================================
REM Activer le demarrage automatique d'AgosoftGed au login Windows
REM A lancer UNE FOIS sur le PC cible.
REM ============================================================

REM Dossier demarrage Windows de l'utilisateur courant
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

REM Script VBS silencieux qui attend Docker puis lance docker compose
set "TARGET=%~dp0scripts\agosoftged-autostart.vbs"

REM Raccourci cree dans le dossier Demarrage
set "LINK=%STARTUP%\AgosoftGed.lnk"

REM Creation du raccourci via PowerShell (cible wscript.exe + le .vbs)
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LINK%');" ^
  "$s.TargetPath='wscript.exe';" ^
  "$s.Arguments='\"%TARGET%\"';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.WindowStyle=7;" ^
  "$s.Description='Demarre AgosoftGed avec Docker au login';" ^
  "$s.Save()"

REM Confirmation a l'ecran
echo.
echo Demarrage automatique active.
echo Au prochain login Windows, AgosoftGed demarrera sans clic.
echo Ouvrir ensuite : http://localhost:3001
echo.
echo Pour desactiver : double-cliquer sur desactiver-demarrage-auto.bat
echo.

REM Pause pour laisser lire le message
pause
