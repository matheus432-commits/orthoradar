@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title OrthoFollow — Instalador

echo.
echo ╔══════════════════════════════════════════╗
echo ║       OrthoFollow — Instalador           ║
echo ║       Análise Facial Ortodôntica         ║
echo ╚══════════════════════════════════════════╝
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js não encontrado.
    echo.
    echo  Instale em: https://nodejs.org  (versão LTS)
    echo  Após instalar, execute este script novamente.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK] Node.js %NODE_VER%

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker Desktop não encontrado.
    echo.
    echo  Instale em: https://www.docker.com/products/docker-desktop
    echo  Após instalar e iniciar o Docker, execute este script novamente.
    pause
    exit /b 1
)
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker Desktop não está em execução.
    echo  Abra o Docker Desktop e aguarde inicializar, depois execute novamente.
    pause
    exit /b 1
)
echo [OK] Docker Desktop ativo

set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
pushd "%PROJECT_DIR%"

echo.
echo [1/4] Configurando banco de dados...

docker inspect pg-orthofollow >nul 2>&1
if %errorlevel% equ 0 (
    echo   Container pg-orthofollow já existe, iniciando...
    docker start pg-orthofollow >nul 2>&1
) else (
    echo   Criando container PostgreSQL...
    docker run -d ^
      --name pg-orthofollow ^
      --restart unless-stopped ^
      -e POSTGRES_USER=ortho ^
      -e POSTGRES_PASSWORD=orthofollow2024 ^
      -e POSTGRES_DB=orthofollow ^
      -p 5432:5432 ^
      postgres:16-alpine >nul 2>&1
    if %errorlevel% neq 0 (
        echo [ERRO] Falha ao criar container PostgreSQL.
        pause & exit /b 1
    )
    echo   Aguardando PostgreSQL inicializar...
    timeout /t 5 /nobreak >nul
)

set "DATABASE_URL=postgres://ortho:orthofollow2024@localhost:5432/orthofollow"

echo.
echo [2/4] Aplicando migrations...
for %%f in (migrations\*.sql) do (
    echo   -> %%f
    docker exec -i pg-orthofollow psql -U ortho -d orthofollow < "%%f" >nul 2>&1
)
echo   Migrations aplicadas.

echo.
echo [3/4] Instalando dependências e compilando...
call npm install --silent 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha no npm install.
    pause & exit /b 1
)
call npm run build --workspaces --silent 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Falha no build.
    pause & exit /b 1
)
echo   Build concluído.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "169.254"') do (
    set "LOCAL_IP=%%a"
    goto :ip_found
)
:ip_found
set "LOCAL_IP=%LOCAL_IP: =%"

echo.
echo [4/4] Iniciando servidor...
echo.

set "DATABASE_URL=postgres://ortho:orthofollow2024@localhost:5432/orthofollow"
set "WEB_ROOT=%PROJECT_DIR%\apps\web"
set "PORT=3000"
set "NODE_ENV=production"

echo ╔══════════════════════════════════════════╗
echo ║  OrthoFollow está rodando!               ║
echo ║                                          ║
echo ║  Este computador:                        ║
echo ║    http://localhost:3000                 ║
echo ║                                          ║
echo ║  Rede local (outros dispositivos):       ║
echo ║    http://%LOCAL_IP%:3000           ║
echo ║                                          ║
echo ║  Para iniciar novamente:                 ║
echo ║    scripts\iniciar.bat                   ║
echo ║                                          ║
echo ║  Pressione Ctrl+C para parar.            ║
echo ╚══════════════════════════════════════════╝
echo.

start "" "http://localhost:3000"

node packages\api\dist\server.js

popd
