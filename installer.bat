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

echo [INFO] SQL Server = instance Windows locale (hors Docker)

echo.
echo Build + demarrage (peut prendre plusieurs minutes la 1ere fois)...
echo.

docker compose up --build -d
if errorlevel 1 (
  echo.
  echo [ERREUR] Echec du demarrage. Logs :
  docker compose logs --tail 80
  pause
  exit /b 1
)

echo.
echo Etat des conteneurs :
docker compose ps
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
