@echo off
cd /d "%~dp0"
set PYTHON="%~dp0..\django_env\Scripts\python.exe"

if not exist %PYTHON% (
  echo Erreur : environnement django_env introuvable.
  pause
  exit /b 1
)

echo Backend accessible sur :
echo   - http://127.0.0.1:8000
echo   - http://localhost:8000
echo   - http://192.168.1.40:8000  (reseau local)
echo.
echo Utilisez ce script plutot que "python manage.py runserver" seul.
echo.
%PYTHON% manage.py runserver 0.0.0.0:8000
