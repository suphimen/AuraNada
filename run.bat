@echo off
title AuraNada
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Electron not found: node_modules\electron\dist\electron.exe
  pause
  exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" .
exit /b