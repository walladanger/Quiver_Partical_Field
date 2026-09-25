@echo off
cd /d "%~dp0.."
node --experimental-strip-types desktop\launcher.ts
if errorlevel 1 pause
