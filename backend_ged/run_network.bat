@echo off
cd /d "%~dp0"
set PYTHON="%~dp0..\django_env\Scripts\python.exe"

if not exist %PYTHON% (
  echo Erreur : environnement django_env introuvable.
  echo Creez-le ou installez les dependances avec :
  echo   ..\django_env\Scripts\pip.exe install -r requirements.txt
  pause
  exit /b 1
)

echo Backend GED accessible sur le reseau : http://192.168.1.40:8000
echo Python utilise : %PYTHON%
%PYTHON% manage.py runserver 0.0.0.0:8000
