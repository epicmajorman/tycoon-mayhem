@echo off
title TYCOON MAYHEM
cd /d "%~dp0"
echo ============================================
echo   TYCOON MAYHEM - starting up...
echo ============================================
start "TYCOON MAYHEM relay (keep open for LAN play)" cmd /c "node server/server.mjs"
timeout /t 1 >nul
start "" http://localhost:8123
node server/serve.mjs 8123
