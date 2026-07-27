@echo off
REM ============================================================
REM INSTALLATEUR UNIQUE AgosoftGed (AMD64 et ARM64)
REM Double-cliquer une seule fois sur un nouveau PC.
REM ============================================================
cd /d "%~dp0"
setlocal EnableExtensions

echo ========================================
echo   AgosoftGed - Installation Docker
echo ========================================
echo.

REM --- Verifier Docker ---
docker info >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Docker Desktop n'est pas demarre.
  echo Installez la bonne version :
  echo   - PC Intel/AMD  → Docker Desktop Windows AMD64
  echo   - PC ARM        → Docker Desktop Windows ARM64
  echo Puis relancez ce script.
  pause
  exit /b 1
)

REM --- .env ---
if not exist "backend_ged\config\.env" (
  if exist "backend_ged\config\.env.example" (
    copy /Y "backend_ged\config\.env.example" "backend_ged\config\.env" >nul
    echo [OK] Fichier .env cree depuis .env.example
  ) else (
    echo [ERREUR] backend_ged\config\.env.example introuvable.
    pause
    exit /b 1
  )
) else (
  echo [OK] Fichier .env deja present
)

REM --- Detecter architecture ---
set "USE_ARM=0"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "USE_ARM=1"
if /I "%PROCESSOR_ARCHITECTURE%"=="ARM" set "USE_ARM=1"

if "%USE_ARM%"=="1" (
  echo [INFO] PC ARM64 detecte → Azure SQL Edge + images arm64
  echo arm> "%~dp0.agosoftged-arm"
  set "COMPOSE_CMD=docker compose -f docker-compose.yml -f docker-compose.arm.yml"
) else (
  echo [INFO] PC AMD64/Intel detecte → SQL Server 2022 + images amd64
  if exist "%~dp0.agosoftged-arm" del "%~dp0.agosoftged-arm" >nul 2>&1
  set "COMPOSE_CMD=docker compose"
)

echo.
echo Build + demarrage (peut prendre plusieurs minutes la 1ere fois)...
echo.

%COMPOSE_CMD% up --build -d
if errorlevel 1 (
  echo.
  echo [ERREUR] Echec du demarrage. Logs :
  %COMPOSE_CMD% logs --tail 80
  pause
  exit /b 1
)

echo.
echo Etat des conteneurs :
%COMPOSE_CMD% ps
echo.

REM --- Demarrage auto Windows ---
echo Activation du demarrage automatique au login...
call "%~dp0activer-demarrage-auto.bat" SILENT

echo.
echo ========================================
echo   Installation terminee
echo   Ouvrir : http://localhost:3001
echo ========================================
echo.
start "" "http://localhost:3001"
pause
