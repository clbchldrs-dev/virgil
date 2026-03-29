@echo off
REM Double-click launcher (Windows): starts Virgil via Docker Compose. Requires Docker Desktop + Ollama.
setlocal
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-virgil.ps1"
