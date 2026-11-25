param(
    [switch]$Stop,
    [switch]$Install,
    [switch]$Hosted,
    [switch]$Local
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $repo 'backend'
$frontend = Join-Path $repo 'frontend'
$browserJob = $null

function Require-Command($name, $hint) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name is unavailable. $hint"
    }
}

function Invoke-Supabase {
    if (Get-Command supabase -ErrorAction SilentlyContinue) {
        & supabase @args
    } else {
        & npx.cmd --yes supabase@2 @args
    }
}

Push-Location $backend
try {
    if ($Hosted -and $Stop) { throw '-Stop only applies to local Supabase.' }
    if ($Hosted -and $Local) { throw 'Choose either -Hosted or -Local.' }
    if (-not ($Hosted -or $Local -or $Stop)) {
        if (Get-Command docker -ErrorAction SilentlyContinue) {
            try {
                docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
                $Hosted = $LASTEXITCODE -ne 0
            } catch {
                $Hosted = $true
            }
        } else {
            $Hosted = $true
        }
    }
    if (-not $Stop) {
        Require-Command node 'Install Node.js 24.'
        Require-Command npm.cmd 'Install npm with Node.js 24.'
        if ((node --version) -notmatch '^v24\.') { throw 'This repository requires Node.js 24.x.' }
    }

    if (-not $Hosted) {
        Require-Command docker 'Install and start Docker Desktop for local Supabase, or run run-safr.bat -Hosted to use your existing hosted project.'
        docker info --format '{{.ServerVersion}}' | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw 'Docker is not ready. Open Docker Desktop and wait for the engine to start.'
        }

        if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
            Require-Command npx.cmd 'Install Node.js 24 with npm, or install the Supabase CLI.'
        }

        if ($Stop) {
            Invoke-Supabase stop
            if ($LASTEXITCODE -ne 0) { throw 'Could not stop the local Supabase stack.' }
            exit 0
        }

        Write-Host 'Starting local Supabase (database, Auth, and Realtime)...'
        $startOutput = Invoke-Supabase start
        if ($LASTEXITCODE -ne 0) {
            throw 'Supabase could not start. Check Docker and the Supabase errors above.'
        }
        # Startup and status output can contain local credentials.
        $startOutput = $null
        Write-Host 'Applying pending local database migrations...'
        Invoke-Supabase migration up --local
        if ($LASTEXITCODE -ne 0) { throw 'Local database migrations failed.' }

        $status = Invoke-Supabase status --output json | Out-String
        if ($LASTEXITCODE -ne 0) { throw 'Could not read the local Supabase configuration.' }
        $local = ConvertFrom-Json -InputObject $status
        $api = [Uri]$local.API_URL
        if (-not $api.IsAbsoluteUri -or -not $api.IsLoopback -or
            -not $local.ANON_KEY -or -not $local.SERVICE_ROLE_KEY) {
            throw 'Expected a loopback Supabase URL and local anon/service-role keys. Safr did not start.'
        }

        # Process-scoped values take precedence over the existing frontend/.env.
        $env:VITE_SUPABASE_URL = $api.AbsoluteUri.TrimEnd('/')
        $env:SUPABASE_URL = $env:VITE_SUPABASE_URL
        $env:VITE_SUPABASE_PUBLISHABLE_KEY = $local.ANON_KEY
        $env:SUPABASE_PUBLISHABLE_KEY = $local.ANON_KEY
        $env:SUPABASE_SERVICE_ROLE_KEY = $local.SERVICE_ROLE_KEY
    } else {
        if (-not (Test-Path (Join-Path $frontend '.env'))) {
            throw 'Hosted mode requires the Supabase connection settings in frontend/.env.'
        }
        Write-Host 'Using the hosted Supabase project configured in frontend/.env. App changes can affect that project.'
    }
    $env:NOTIFY_MODE = 'mock'

    Set-Location $frontend
    if ($Install -or -not (Test-Path 'node_modules/.bin/vite.cmd')) {
        Write-Host 'Installing frontend dependencies from the lockfile...'
        npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    }

    Write-Host 'App and backend server functions: http://localhost:5173'
    if ($local.STUDIO_URL) { Write-Host "Supabase Studio: $($local.STUDIO_URL)" }
    $mailUrl = $local.MAILPIT_URL
    if (-not $mailUrl) { $mailUrl = $local.INBUCKET_URL }
    if ($mailUrl) { Write-Host "Local auth emails: $mailUrl" }
    Write-Host 'Press Ctrl+C to stop the app.'
    if (-not $Hosted) { Write-Host 'Run run-safr.bat -Stop to stop Supabase and keep its data.' }
    if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) {
        throw 'Port 5173 is already in use. Close the existing server and run the launcher again.'
    }
    $browserJob = Start-Job -ScriptBlock {
        $url = 'http://localhost:5173/'
        $deadline = [DateTime]::UtcNow.AddMinutes(2)
        while ([DateTime]::UtcNow -lt $deadline) {
            try {
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
                if ($response.StatusCode -eq 200) {
                    Start-Process $url
                    break
                }
            } catch {}
            Start-Sleep -Milliseconds 500
        }
    }
    npm.cmd run dev '--' --host localhost --port 5173 --strictPort
    exit $LASTEXITCODE
} catch {
    Write-Host "[Safr] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    if ($browserJob) { Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue }
    Pop-Location
}
