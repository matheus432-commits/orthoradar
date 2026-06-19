@echo off
chcp 65001 >nul
title OrthoFollow - Instalador

echo.
echo ==========================================
echo   OrthoFollow - Instalador
echo   Analise Facial Ortodontica
echo ==========================================
echo.

:: Verifica Node.js
node -v >nul 2>&1
if not %errorlevel% == 0 (
    echo [ERRO] Node.js nao encontrado.
    echo Instale em: https://nodejs.org  (versao LTS)
    echo Apos instalar, execute este script novamente.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js %%v

:: Verifica Docker
docker info >nul 2>&1
if not %errorlevel% == 0 (
    echo [ERRO] Docker Desktop nao esta em execucao.
    echo Abra o Docker Desktop e aguarde inicializar, depois execute novamente.
    pause
    exit /b 1
)
echo [OK] Docker Desktop ativo

:: Vai para raiz do projeto
cd /d "%~dp0.."
echo [OK] Diretorio: %CD%

:: PostgreSQL via Docker
echo.
echo [1/4] Configurando banco de dados...

docker inspect pg-orthofollow >nul 2>&1
if %errorlevel% == 0 (
    echo   Container ja existe, iniciando...
    docker start pg-orthofollow >nul 2>&1
) else (
    echo   Criando container PostgreSQL...
    docker run -d --name pg-orthofollow --restart unless-stopped -e POSTGRES_USER=ortho -e POSTGRES_PASSWORD=orthofollow2024 -e POSTGRES_DB=orthofollow -p 5432:5432 postgres:16-alpine
    if not %errorlevel% == 0 (
        echo [ERRO] Falha ao criar container PostgreSQL.
        pause
        exit /b 1
    )
    echo   Aguardando PostgreSQL inicializar...
    timeout /t 6 /nobreak >nul
)
echo   Banco pronto.

:: Aplica migrations
echo.
echo [2/4] Aplicando migrations...
for %%f in (migrations\*.sql) do (
    echo   -^> %%f
    docker exec -i pg-orthofollow psql -U ortho -d orthofollow < "%%f"
)
echo   Migrations aplicadas.

:: Instala dependencias e build
echo.
echo [3/4] Instalando dependencias e compilando...
call npm install
if not %errorlevel% == 0 (
    echo [ERRO] Falha no npm install.
    pause
    exit /b 1
)
call npm run build --workspaces
if not %errorlevel% == 0 (
    echo [ERRO] Falha no build.
    pause
    exit /b 1
)
echo   Build concluido.

:: Descobre IP local
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "169.254"') do (
    set "LOCAL_IP=%%a"
    goto :ip_found
)
:ip_found
set "LOCAL_IP=%LOCAL_IP: =%"

:: Inicia servidor
echo.
echo [4/4] Iniciando servidor...
echo.
echo ==========================================
echo   OrthoFollow esta rodando!
echo.
echo   Este computador : http://localhost:3000
echo   Rede local      : http://%LOCAL_IP%:3000
echo.
echo   Para iniciar novamente: scripts\iniciar.bat
echo   Pressione Ctrl+C para parar.
echo ==========================================
echo.

set DATABASE_URL=postgres://ortho:orthofollow2024@localhost:5432/orthofollow
set WEB_ROOT=%CD%\apps\web
set PORT=3000
set NODE_ENV=production

start "" "http://localhost:3000"

node packages\api\dist\server.js
