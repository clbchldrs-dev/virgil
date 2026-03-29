# Start Virgil via Docker Compose (Windows). Requires Docker Desktop.
# Run from repo root: powershell -ExecutionPolicy Bypass -File packaging/launch-virgil.ps1
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Root = Resolve-Path $Root
Set-Location $Root

function Fail {
    param([string]$Msg)
    Write-Error "Virgil launcher: $Msg"
    exit 1
}

try {
    docker --version | Out-Null
} catch {
    Fail "Docker is not installed. Install Docker Desktop: https://docs.docker.com/desktop/"
}

try {
    docker compose version | Out-Null
} catch {
    Fail "Docker Compose v2 is required."
}

$EnvDocker = Join-Path $Root ".env.docker"
$Example = Join-Path $Root ".env.docker.example"
if (-not (Test-Path $EnvDocker)) {
    Write-Host "Virgil launcher: creating .env.docker from .env.docker.example"
    Copy-Item $Example $EnvDocker
}

$content = Get-Content $EnvDocker -Raw
if ($content -notmatch '(?m)^AUTH_SECRET=.+') {
    Write-Host "Virgil launcher: generating AUTH_SECRET in .env.docker"
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    if ($content -match '(?m)^AUTH_SECRET=') {
        $content = [regex]::Replace($content, '(?m)^AUTH_SECRET=.*', "AUTH_SECRET=$secret")
    } else {
        $content = $content.TrimEnd() + "`nAUTH_SECRET=$secret`n"
    }
    Set-Content -Path $EnvDocker -Value $content -NoNewline
}

$BaseUrl = $env:VIRGIL_OPEN_URL
if (-not $BaseUrl) {
    $DotEnv = Join-Path $Root ".env"
    if (Test-Path $DotEnv) {
        $m = Select-String -Path $DotEnv -Pattern '^NEXT_PUBLIC_APP_URL=(.+)$' | Select-Object -First 1
        if ($m) { $BaseUrl = $m.Matches.Groups[1].Value.Trim() }
    }
    if (-not $BaseUrl) {
        $m2 = Select-String -Path $EnvDocker -Pattern '^NEXT_PUBLIC_APP_URL=(.+)$' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($m2) { $BaseUrl = $m2.Matches.Groups[1].Value.Trim() }
    }
    if (-not $BaseUrl) { $BaseUrl = "http://localhost:3000" }
}

if (Get-Command pnpm -ErrorAction SilentlyContinue) {
    if (Test-Path (Join-Path $Root "scripts\virgil-preflight.ts")) {
        pnpm exec tsx scripts/virgil-preflight.ts --strict
        if ($LASTEXITCODE -ne 0) { Fail "Preflight failed." }
    }
}

Write-Host "Virgil launcher: starting stack (docker compose up --build -d)..."
docker compose up --build -d

Write-Host "Virgil launcher: waiting for $BaseUrl ..."
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $ok = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}

if (-not $ok) {
    Fail "Server did not become ready. Try: docker compose logs -f virgil-app"
}

Write-Host "Virgil launcher: opening $BaseUrl"
Start-Process $BaseUrl

Write-Host "Virgil launcher: running. To stop: .\packaging\stop-virgil.ps1"
