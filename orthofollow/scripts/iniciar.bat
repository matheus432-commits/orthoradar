@echo off
chcp 65001 >nul
title OrthoFollow

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1" ^| findstr /v "169.254"') do (
    set "LOCAL_IP=%%a"
    goto :found
)
:found
set "LOCAL_IP=%LOCAL_IP: =%"

echo.
echo ╔══════════════════════════════════════════╗
echo ║  OrthoFollow — Análise Facial            ║
echo ╚══════════════════════════════════════════╝
echo.
echo  Iniciando banco de dados...
docker start pg-orthofollow >nul 2>&1
timeout /t 2 /nobreak >nul

echo  Iniciando servidor...
echo.
echo  Acesse no navegador:
echo    Este computador : http://localhost:3000
echo    Rede local      : http://%LOCAL_IP%:3000
echo.
echo  Pressione Ctrl+C para parar.
echo.

cd /d "%~dp0.."

set DATABASE_URL=postgres://ortho:orthofollow2024@localhost:5432/orthofollow
set WEB_ROOT=%~dp0..\apps\web
set PORT=3000
set NODE_ENV=production

start "" "http://localhost:3000"

node packages\api\dist\server.js
