@echo off
rem Tache planifiee GED : resume periodique (chemins relatifs a backend_ged).
set "SCRIPTS_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPTS_DIR%.."
cd /d "%BACKEND_DIR%"

rem Environnement virtuel : frere de backend_ged (../django_env), sinon PATH.
set "PYTHON_EXE=%BACKEND_DIR%\..\django_env\Scripts\python.exe"
if not exist "%PYTHON_EXE%" set "PYTHON_EXE=python"

"%PYTHON_EXE%" manage.py envoyer_resume_periodique >> "%SCRIPTS_DIR%resume_periodique.log" 2>&1
