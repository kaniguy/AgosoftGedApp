@echo off
cd /d "%~dp0"
set PYTHON="%~dp0..\django_env\Scripts\python.exe"
set LOGFILE=%~dp0logs\logs_backend
set PREPEND=%~dp0scripts\prepend_log_line.py
set PREPEND_PIPE=%~dp0scripts\prepend_log_pipe.py

if not exist %PYTHON% (
  echo Erreur : environnement django_env introuvable.
  pause
  exit /b 1
)

echo Backend accessible sur :
echo   - http://127.0.0.1:9000
echo   - http://localhost:9000
echo   - http://192.168.1.40:9000  (reseau local)
echo.
echo Logs : %LOGFILE% (plus recent en haut)
echo Utilisez ce script plutot que "python manage.py runserver" seul.
echo.
powershell -NoProfile -Command "$d = Get-Date -Format 'dd/MMM/yyyy HH:mm:ss'; & '%~dp0..\django_env\Scripts\python.exe' '%PREPEND%' '%LOGFILE%' \"[$d] Watching for file changes with StatReloader\"; & '%~dp0..\django_env\Scripts\python.exe' '%PREPEND%' '%LOGFILE%' \"[$d] Starting development server at http://127.0.0.1:9000/\""
powershell -NoProfile -Command "& { & '%~dp0..\django_env\Scripts\python.exe' manage.py runserver 0.0.0.0:9000 2>&1 | & '%~dp0..\django_env\Scripts\python.exe' '%PREPEND_PIPE%' '%LOGFILE%' }"
