@echo off
setlocal
title Safr - Local development
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0misc\run-local-stack.ps1" %*
set "SAFR_EXIT=%ERRORLEVEL%"
if not "%SAFR_EXIT%"=="0" pause
exit /b %SAFR_EXIT%
