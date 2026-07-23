@echo off
REM ============================================================
REM Desactiver le demarrage automatique d'AgosoftGed au login
REM ============================================================

REM Chemin du raccourci dans le dossier Demarrage Windows
set "LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AgosoftGed.lnk"

REM Si le raccourci existe, le supprimer ; sinon afficher un message
if exist "%LINK%" (
  del "%LINK%"
  echo Demarrage automatique desactive.
) else (
  echo Aucun raccourci de demarrage automatique trouve.
)

REM Pause pour laisser lire le message
echo.
pause
