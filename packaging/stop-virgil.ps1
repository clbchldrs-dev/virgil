# Stop Virgil Docker Compose stack (Windows).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location (Resolve-Path $Root)
Write-Host "Virgil: docker compose down"
docker compose down
