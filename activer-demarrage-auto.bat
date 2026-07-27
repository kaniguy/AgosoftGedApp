@echo off
REM ============================================================
REM Activer le demarrage automatique d'AgosoftGed au login Windows
REM A lancer UNE FOIS (ou via installer.bat).
REM ============================================================

set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%~dp0scripts\agosoftged-autostart.vbs"
set "LINK=%STARTUP%\AgosoftGed.lnk"

powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut('%LINK%');" ^
  "$s.TargetPath='wscript.exe';" ^
  "$s.Arguments='\"%TARGET%\"';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.WindowStyle=7;" ^
  "$s.Description='Demarre AgosoftGed avec Docker au login';" ^
  "$s.Save()"

echo Demarrage automatique active (login Windows).

REM Pas de pause si appele par installer.bat
if /I "%~1"=="SILENT" exit /b 0

echo Ouvrir ensuite : http://localhost:3001
echo Pour desactiver : desactiver-demarrage-auto.bat
echo.
pause
