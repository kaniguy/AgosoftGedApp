@echo off
cd /d "%~dp0"
set PYTHON="%~dp0..\django_env\Scripts\python.exe"
set LOGFILE=%~dp0logs_backend
set PREPEND_PIPE=%~dp0scripts\prepend_log_pipe.py

if not exist %PYTHON% (
  echo Erreur : environnement django_env introuvable.
  echo Creez-le ou installez les dependances avec :
  echo   ..\django_env\Scripts\pip.exe install -r requirements.txt
  pause
  exit /b 1
)

echo Backend GED accessible sur le reseau : http://192.168.1.40:9000
echo Python utilise : %PYTHON%
echo Logs : %LOGFILE% (plus recent en haut)
powershell -NoProfile -Command "& { & '%~dp0..\django_env\Scripts\python.exe' manage.py runserver 0.0.0.0:9000 2>&1 | & '%~dp0..\django_env\Scripts\python.exe' '%PREPEND_PIPE%' '%LOGFILE%' }"
