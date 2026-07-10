# qBit Mobile deployment for Windows (PowerShell 7+).
#
# Installs to $env:LOCALAPPDATA\qbit-mobile and registers a per-user Scheduled
# Task that runs at logon (no UAC, no service install). The task action runs a
# small generated PowerShell wrapper that starts node and captures logs.
#
# Run as the regular user (not elevated). The script aborts if the Node on
# PATH is older than package.json engines.node, or if invoked from outside
# the qbit-mobile repo root.

#Requires -Version 7.0

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$AppName        = 'qbit-mobile'
$AppDir         = Join-Path $env:LOCALAPPDATA $AppName
$LogDir         = Join-Path $AppDir 'logs'
$LogFile        = Join-Path $LogDir 'qbit-mobile.log'
$RunnerScript   = Join-Path $AppDir 'run-qbit-mobile.ps1'
$TaskName       = 'qbit-mobile'
$EnvFile        = Join-Path $AppDir '.env'

$Script:GeneratedPassword = $null

function Write-Msg     { param([string]$Text) Write-Host "[+] $Text" -ForegroundColor Green }
function Write-Warn    { param([string]$Text) Write-Host "[*] $Text" -ForegroundColor Yellow }
function Write-Err     { param([string]$Text) Write-Host "[!] $Text" -ForegroundColor Red }

function Test-Administrator {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($id)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (Test-Administrator) {
    Write-Warn "Running elevated. The Scheduled Task will still register as the current user; elevation isn't required."
}

Write-Msg "Checking prerequisites..."

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Err "Node.js is not installed or not on PATH. Install Node.js first (see package.json engines; e.g., 'winget install OpenJS.NodeJS.LTS')."
    exit 1
}
$NodeBin = $nodeCmd.Source
$PwshBin = (Get-Process -Id $PID).Path
if (-not $PwshBin -or -not (Test-Path $PwshBin)) {
    $pwshCmd = Get-Command pwsh -ErrorAction SilentlyContinue
    if (-not $pwshCmd) {
        Write-Err "PowerShell 7 executable could not be resolved."
        exit 1
    }
    $PwshBin = $pwshCmd.Source
}

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
    Write-Err "npm is not installed. Please install npm first."
    exit 1
}

# Refuse to run anywhere but the repo root: the staging copy below stages the
# current directory's tracked files, so from the wrong CWD it would stage the
# wrong tree.
foreach ($required in @('server','src','public','package.json')) {
    if (-not (Test-Path $required)) {
        Write-Err "Run this script from the qbit-mobile repo root (missing .\$required)."
        exit 1
    }
}

# The supported Node floor is declared once, in package.json `engines.node`, and
# read from there. It used to be restated as a literal `22.12` here, which is how
# this script drifted from the floor that matters. Enforce the minor too: a bare
# major check lets 22.0..22.11 through, and the build then fails deep inside vite.
$enginesNode = [string](& $NodeBin -p "require('./package.json').engines.node" 2>$null)
$floorMatch = [regex]::Match($enginesNode, '^>=(\d+)\.(\d+)')
if (-not $floorMatch.Success) {
    Write-Err "Could not read a '>=X.Y' floor from package.json engines.node (got: '$enginesNode')."
    exit 1
}
$floorMajor = [int]$floorMatch.Groups[1].Value
$floorMinor = [int]$floorMatch.Groups[2].Value

$nodeVer = (& $NodeBin -v).TrimStart('v')
$verParts = $nodeVer.Split('.')
$nodeMajor = [int]$verParts[0]
$nodeMinor = [int]$verParts[1]
if ($nodeMajor -lt $floorMajor -or ($nodeMajor -eq $floorMajor -and $nodeMinor -lt $floorMinor)) {
    Write-Err "Node.js $floorMajor.$floorMinor+ is required. Current version: v$nodeVer"
    exit 1
}

$RepoRoot = (Get-Location).Path

# Everything is built in a staging directory and swapped into place only once
# the build has succeeded. Previously the script deleted the installed source,
# copied, then built — so a failed build (or a failed npm ci) left a
# half-updated install: new server code, new node_modules, old dist, old
# process still running.
$StageDir = "$AppDir.stage"
$PrevDir  = $null

# Stage exactly the files git tracks — see deploy.sh for the full rationale: a
# hand-maintained copy list drifts silently (adding build-id.ts at the repo
# root broke the deploy), and an exclude list fails open, staging the ignored
# .env.local/.env.production secrets. `git ls-files` is an allowlist that
# maintains itself; everything unwanted (.git, node_modules, dist, data, every
# .env*) falls out for free because none of it is tracked.
#
# Unlike deploy.sh this does not pipe through tar: Windows 10/11 ship bsdtar
# but it is not guaranteed, so each tracked path is copied individually.
# git ls-files output is newline-delimited; filenames containing newlines
# cannot occur on Windows. Files are read from the working tree, not from
# HEAD, preserving the previous behaviour of deploying what is checked out.
& git -C $RepoRoot rev-parse --git-dir *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Err "Not a git repository. deploy.ps1 stages the files git tracks; run it from a clone, not from an extracted archive."
    exit 1
}

try {
    Write-Msg "Staging application files..."
    if (Test-Path $StageDir) { Remove-Item -Path $StageDir -Recurse -Force }
    New-Item -ItemType Directory -Path $StageDir -Force | Out-Null
    # AppDir is created for the .env step below; the swap replaces it wholesale.
    New-Item -ItemType Directory -Path $AppDir -Force | Out-Null

    $trackedFiles = & git -C $RepoRoot ls-files
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git ls-files failed."
        exit 1
    }
    foreach ($rel in $trackedFiles) {
        if ([string]::IsNullOrWhiteSpace($rel)) { continue }
        $src  = Join-Path $RepoRoot $rel
        $dest = Join-Path $StageDir $rel
        $destParent = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $destParent)) {
            New-Item -ItemType Directory -Path $destParent -Force | Out-Null
        }
        Copy-Item -LiteralPath $src -Destination $dest -Force
    }
    Write-Msg "Staged application files"

    Push-Location $StageDir
    try {
        Write-Msg "Installing dependencies..."
        # No fallback to `npm install` -- see deploy.sh for why: it would resolve
        # fresh versions from the registry and deploy a tree nothing tested.
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed (lockfile out of sync?)" }

        Write-Msg "Building frontend..."
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw "Frontend build failed" }

        Write-Msg "Pruning dev dependencies..."
        & npm prune --omit=dev
        if ($LASTEXITCODE -ne 0) { throw "npm prune failed" }
    } finally {
        Pop-Location
    }

    # --- .env handling --------------------------------------------------

    function Read-WithDefault {
        param([string]$Prompt, [string]$Default)
        $val = Read-Host "$Prompt [$Default]"
        $val = $val.Trim()
        if ([string]::IsNullOrEmpty($val)) { return $Default }
        return $val
    }

    function Read-Secret {
        param([string]$Prompt)
        $secure = Read-Host -AsSecureString $Prompt
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
        try {
            return [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }

    function Test-PortValid {
        param([string]$P)
        if ($P -notmatch '^\d+$') { return $false }
        $n = [int]$P
        return ($n -ge 1 -and $n -le 65535)
    }

    function New-RandomPassword {
        # 24-char alphanumeric drawn from a cryptographically strong source.
        # Drop base64 punctuation so the password is easy to type on a phone.
        $bytes = New-Object byte[] 24
        $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
        $chars = foreach ($b in $bytes) { $alphabet[$b % $alphabet.Length] }
        return -join $chars
    }

    function Format-EnvValue {
        # Wrap value in double quotes; escape \, ", $ so dotenv reads it back
        # verbatim regardless of what characters the user pasted.
        param([string]$V)
        if ($null -eq $V) { $V = '' }
        $V = $V.Replace('\','\\').Replace('"','\"').Replace('$','\$')
        return ('"' + $V + '"')
    }

    function Prompt-AppAuth {
        param([string]$AppHost)
        while ($true) {
            Write-Host ""
            Write-Msg "Web UI authentication setup:"
            Write-Host "1) Basic auth (recommended - required for anything beyond localhost)"
            Write-Host "2) Disabled (no auth - only safe on a fully trusted LAN)"
            $choice = (Read-Host "Choose authentication method [1]").Trim()
            if ([string]::IsNullOrEmpty($choice)) { $choice = '1' }
            switch ($choice) {
                '1' {
                    $Script:AuthMode = 'basic'
                    $Script:AppUser  = Read-WithDefault 'Web UI username' 'admin'
                    $pw = Read-Secret 'Web UI password (leave blank to auto-generate)'
                    if ([string]::IsNullOrEmpty($pw)) {
                        $pw = New-RandomPassword
                        $Script:GeneratedPassword = $pw
                        Write-Msg "Generated a random password."
                    }
                    $Script:AppPass = $pw
                    return
                }
                '2' {
                    if ($AppHost -ne '127.0.0.1' -and $AppHost -ne '::1' -and $AppHost -ne 'localhost') {
                        Write-Warn "AUTH_MODE=disabled with HOST=$AppHost means anyone on the network can drive qBittorrent."
                        $confirm = (Read-Host "Type 'yes' to confirm, anything else to choose again").Trim()
                        if ($confirm -ne 'yes') { continue }
                    }
                    $Script:AuthMode = 'disabled'
                    $Script:AppUser  = ''
                    $Script:AppPass  = ''
                    Write-Msg "Web UI auth disabled."
                    return
                }
                default { Write-Warn "Invalid choice. Enter 1 or 2." }
            }
        }
    }

    function Write-EnvFile {
        param(
            [string]$AppPort, [string]$AppHost,
            [string]$AuthMode, [string]$AppUser, [string]$AppPass,
            [string]$QbHost, [string]$QbPort, [string]$QbUser, [string]$QbPass
        )
        $lines = @(
            '# qBit Mobile Configuration',
            '',
            '# --- App server ---',
            "NODE_ENV=$(Format-EnvValue 'production')",
            "PORT=$(Format-EnvValue $AppPort)",
            "HOST=$(Format-EnvValue $AppHost)",
            '',
            '# --- App authentication ---',
            "AUTH_MODE=$(Format-EnvValue $AuthMode)",
            "APP_USERNAME=$(Format-EnvValue $AppUser)",
            "APP_PASSWORD=$(Format-EnvValue $AppPass)",
            '',
            '# --- Upstream qBittorrent ---',
            "QBITTORRENT_HOST=$(Format-EnvValue $QbHost)",
            "QBITTORRENT_PORT=$(Format-EnvValue $QbPort)",
            "QBITTORRENT_USERNAME=$(Format-EnvValue $QbUser)",
            "QBITTORRENT_PASSWORD=$(Format-EnvValue $QbPass)"
        )
        # Use UTF8 without BOM so dotenv parses the first key correctly.
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($EnvFile, ($lines -join "`n") + "`n", $utf8NoBom)
    }

    function Add-AuthToEnv {
        param([string]$AuthMode, [string]$AppUser, [string]$AppPass)
        $append = @(
            '',
            '# --- App authentication (added on upgrade) ---',
            "AUTH_MODE=$(Format-EnvValue $AuthMode)",
            "APP_USERNAME=$(Format-EnvValue $AppUser)",
            "APP_PASSWORD=$(Format-EnvValue $AppPass)"
        )
        Add-Content -Path $EnvFile -Value ($append -join "`n") -Encoding UTF8
    }

    $overwriteEnv = $true
    if (Test-Path $EnvFile) {
        $resp = (Read-Host 'A .env already exists. Overwrite it? [y/N]').Trim()
        $overwriteEnv = $resp -match '^[Yy]'
    }

    if ($overwriteEnv) {
        Write-Msg "Let's collect a few settings. Press Enter for defaults."

        $AppPort = $null
        while ($true) {
            $AppPort = Read-WithDefault 'Web UI port' '3000'
            if (Test-PortValid $AppPort) { break }
            Write-Warn "Invalid port. Enter a number 1-65535."
        }
        $AppHost = Read-WithDefault 'Web UI host to bind' '0.0.0.0'

        Prompt-AppAuth -AppHost $AppHost

        Write-Host ""
        $QbHost = Read-WithDefault 'qBittorrent host' 'localhost'
        $QbPort = $null
        while ($true) {
            $QbPort = Read-WithDefault 'qBittorrent Web UI port' '8080'
            if (Test-PortValid $QbPort) { break }
            Write-Warn "Invalid port. Enter a number 1-65535."
        }

        Write-Host ""
        Write-Msg "qBittorrent authentication setup:"
        Write-Host "1) Local bypass (qBittorrent must have localhost bypass enabled)"
        Write-Host "2) Username/Password"
        $QbUser = ''
        $QbPass = ''
        while ($true) {
            $choice = (Read-Host 'Choose authentication method [1]').Trim()
            if ([string]::IsNullOrEmpty($choice)) { $choice = '1' }
            switch ($choice) {
                '1' {
                    $QbUser = ''
                    $QbPass = ''
                    Write-Msg "Using qBittorrent local bypass mode"
                    break
                }
                '2' {
                    $QbUser = (Read-Host 'qBittorrent username').Trim()
                    if ([string]::IsNullOrEmpty($QbUser)) {
                        Write-Warn "Username cannot be empty"
                        continue
                    }
                    $QbPass = Read-Secret 'qBittorrent password'
                    Write-Msg "Using qBittorrent username/password"
                    break
                }
                default {
                    Write-Warn "Invalid choice. Enter 1 or 2."
                    continue
                }
            }
            break
        }

        Write-Msg "Writing $EnvFile..."
        Write-EnvFile -AppPort $AppPort -AppHost $AppHost `
                      -AuthMode $Script:AuthMode -AppUser $Script:AppUser -AppPass $Script:AppPass `
                      -QbHost $QbHost -QbPort $QbPort -QbUser $QbUser -QbPass $QbPass
    } else {
        Write-Msg ".env file already exists; keeping current values."
        $existingAuth = Select-String -Path $EnvFile -Pattern '^AUTH_MODE=' -Quiet -ErrorAction SilentlyContinue
        if (-not $existingAuth) {
            Write-Warn "Your existing .env predates v1.1 and is missing AUTH_MODE / APP_USERNAME / APP_PASSWORD."
            $existingHostLine = Select-String -Path $EnvFile -Pattern '^HOST=' -ErrorAction SilentlyContinue | Select-Object -First 1
            $existingHost = '0.0.0.0'
            if ($existingHostLine) {
                $existingHost = ($existingHostLine.Line -replace '^HOST=','').Trim('"',' ')
            }
            Prompt-AppAuth -AppHost $existingHost
            Add-AuthToEnv -AuthMode $Script:AuthMode -AppUser $Script:AppUser -AppPass $Script:AppPass
            Write-Msg "Added the new auth keys to $EnvFile."
        }
    }

    # --- Atomic swap ------------------------------------------------------
    #
    # Everything above this point has left the live install untouched: the
    # build happened in $StageDir. Now stop the task, carry live state across,
    # and move the staged tree into place. A failure before this line leaves
    # the previous install running and intact.
    #
    # The task is stopped *before* the state is copied. DATA_DIR defaults to
    # $AppDir\data (server/locations.js), so a write landing between the copy
    # and the swap would otherwise be silently lost.
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Write-Msg "Stopping task '$TaskName' for the swap..."
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    }
    # Stopping the task normally kills its whole process tree, but a stuck
    # instance can leave a child node.exe holding locks that would fail the
    # swap (mirrors uninstall.ps1).
    $oldRunner = Join-Path $AppDir 'run-qbit-mobile.ps1'
    $leftovers = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            ($_.Name -in @('node.exe', 'pwsh.exe', 'powershell.exe')) -and
            $_.CommandLine -like "*$AppDir*" -and
            ($_.CommandLine -like '*server.js*' -or $_.CommandLine -like "*$oldRunner*")
        }
    foreach ($p in $leftovers) {
        Write-Msg "Terminating leftover $($p.Name) (pid $($p.ProcessId))..."
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    }

    Write-Msg "Swapping the new build into $AppDir..."
    if (Test-Path $EnvFile) {
        Copy-Item -LiteralPath $EnvFile -Destination (Join-Path $StageDir '.env') -Force
    }
    if (Test-Path (Join-Path $AppDir 'data')) {
        Copy-Item -LiteralPath (Join-Path $AppDir 'data') -Destination (Join-Path $StageDir 'data') -Recurse -Force
    }

    $PrevDir = "$AppDir.old.$PID"
    Move-Item -LiteralPath $AppDir -Destination $PrevDir
    try {
        Move-Item -LiteralPath $StageDir -Destination $AppDir
    } catch {
        Write-Err "Swap failed. Restoring the previous install."
        Move-Item -LiteralPath $PrevDir -Destination $AppDir
        exit 1
    }

    New-Item -ItemType Directory -Path (Join-Path $AppDir 'data') -Force | Out-Null
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

    # Tighten ACL on .env so non-admin local users can't read the password.
    # Runs after the swap so it applies to the .env that was carried into the
    # live tree, not one about to be replaced.
    try {
        $acl = Get-Acl $EnvFile
        $acl.SetAccessRuleProtection($true, $false)
        $acl.Access | ForEach-Object { [void]$acl.RemoveAccessRule($_) }
        $userRule = New-Object Security.AccessControl.FileSystemAccessRule(
            [Security.Principal.WindowsIdentity]::GetCurrent().Name,
            'FullControl','Allow')
        $sysRule  = New-Object Security.AccessControl.FileSystemAccessRule(
            'NT AUTHORITY\SYSTEM','FullControl','Allow')
        $acl.AddAccessRule($userRule)
        $acl.AddAccessRule($sysRule)
        Set-Acl -Path $EnvFile -AclObject $acl
    } catch {
        Write-Warn ".env ACL tightening failed (continuing): $_"
    }

    # --- Scheduled task -------------------------------------------------

    Write-Msg "Registering Scheduled Task '$TaskName' (runs at logon)..."

    $runnerBody = @'
#Requires -Version 7.0
$ErrorActionPreference = 'Stop'

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir = Join-Path $AppDir 'logs'
$LogFile = Join-Path $LogDir 'qbit-mobile.log'

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
Set-Location $AppDir

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
"[$timestamp] starting qBit Mobile" | Out-File -FilePath $LogFile -Append -Encoding utf8

& '__NODE_BIN__' 'server\server.js' *>> $LogFile
$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }

$timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
"[$timestamp] qBit Mobile exited with code $exitCode" | Out-File -FilePath $LogFile -Append -Encoding utf8
exit $exitCode
'@
    $runnerBody = $runnerBody.Replace('__NODE_BIN__', $NodeBin.Replace("'", "''"))
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($RunnerScript, $runnerBody, $utf8NoBom)

    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Write-Msg "Removing existing task..."
        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    }

    $taskArgs = "-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$RunnerScript`""
    $action = New-ScheduledTaskAction -Execute $PwshBin `
        -Argument $taskArgs `
        -WorkingDirectory $AppDir
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
    $settings = New-ScheduledTaskSettingsSet `
        -Hidden `
        -StartWhenAvailable `
        -DontStopOnIdleEnd `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
        -RestartCount 5 `
        -RestartInterval (New-TimeSpan -Minutes 1)
    $principal = New-ScheduledTaskPrincipal `
        -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
        -LogonType Interactive `
        -RunLevel Limited

    Register-ScheduledTask -TaskName $TaskName `
        -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
        -Description 'qBit Mobile - qBittorrent Web Interface' | Out-Null

    Write-Msg "Starting task..."
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 2

    $taskInfo = Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo
    if ($taskInfo.LastTaskResult -eq 0 -or $taskInfo.LastTaskResult -eq 267009) {
        # 0 = success, 267009 = task is currently running (SCHED_S_TASK_RUNNING)
        # The new build is live and healthy. Only now is the previous tree
        # expendable.
        if ($PrevDir -and (Test-Path $PrevDir)) {
            Remove-Item -Path $PrevDir -Recurse -Force
        }
        Write-Msg "Service started successfully!"
    } else {
        Write-Err "Scheduled task did not start cleanly. LastTaskResult=$($taskInfo.LastTaskResult)"
        if (Test-Path $LogFile) {
            Write-Host ""
            Write-Host "Recent log lines:"
            Get-Content $LogFile -Tail 25 -ErrorAction SilentlyContinue
        }

        # The new build does not run. Put the previous install back, so a
        # failed deploy leaves a working service rather than a broken one.
        if ($PrevDir -and (Test-Path $PrevDir)) {
            Write-Warn "Rolling back to the previous install..."
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Remove-Item -Path $AppDir -Recurse -Force
            Move-Item -LiteralPath $PrevDir -Destination $AppDir
            # The registered task action points at the runner script inside
            # $AppDir; the restored tree carries the previous deploy's runner,
            # so restarting the task is enough.
            Start-ScheduledTask -TaskName $TaskName
            Start-Sleep -Seconds 2
            $taskInfo = Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo
            if ($taskInfo.LastTaskResult -eq 0 -or $taskInfo.LastTaskResult -eq 267009) {
                Write-Msg "Rolled back; the previous version is running again."
            } else {
                Write-Err "Rollback restored $AppDir but the task still will not start."
            }
        }
        exit 1
    }

    # --- Summary --------------------------------------------------------

    $envText = Get-Content $EnvFile -Raw
    function Get-EnvValue {
        param([string]$Key, [string]$Default)
        $m = [regex]::Match($envText, "(?m)^${Key}=`"?([^`"`r`n]*)`"?")
        if ($m.Success) { return $m.Groups[1].Value } else { return $Default }
    }
    $envPort   = Get-EnvValue 'PORT' '3000'
    $envQbHost = Get-EnvValue 'QBITTORRENT_HOST' 'localhost'
    $envQbPort = Get-EnvValue 'QBITTORRENT_PORT' '8080'
    $envAuth   = Get-EnvValue 'AUTH_MODE' 'basic'
    $envUser   = Get-EnvValue 'APP_USERNAME' ''

    $lanIp = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
              Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
              Select-Object -First 1 -ExpandProperty IPAddress)
    if (-not $lanIp) { $lanIp = 'localhost' }

    Write-Msg ""
    Write-Msg "========================================="
    Write-Msg "qBit Mobile has been deployed successfully!"
    Write-Msg ""
    Write-Msg "Configuration:"
    Write-Msg "  Install dir: $AppDir"
    Write-Msg "  Web UI port: $envPort"
    Write-Msg "  qBittorrent: ${envQbHost}:${envQbPort}"
    Write-Msg "  App auth: $envAuth"
    if ($envAuth -eq 'basic') {
        Write-Msg "  App username: $envUser"
    }
    if ($Script:GeneratedPassword) {
        Write-Msg ""
        Write-Warn "Generated app password (shown once - store it now):"
        Write-Warn "  $($Script:GeneratedPassword)"
    }
    Write-Msg ""
    Write-Msg "Management commands:"
    Write-Msg "  Status:  Get-ScheduledTaskInfo -TaskName $TaskName"
    Write-Msg "  Logs:    Get-Content '$LogFile' -Tail 50 -Wait"
    Write-Msg "  Restart: Stop-ScheduledTask -TaskName $TaskName; Start-ScheduledTask -TaskName $TaskName"
    Write-Msg "  Stop:    Stop-ScheduledTask -TaskName $TaskName"
    Write-Msg ""
    Write-Msg "Access the web interface at:"
    Write-Msg "  http://${lanIp}:${envPort}"
    Write-Msg "========================================="
} finally {
    # Mirrors deploy.sh's EXIT trap: a failure anywhere above must not leave
    # the staging tree behind. After a successful swap $StageDir no longer
    # exists and this is a no-op.
    if (Test-Path $StageDir) {
        Remove-Item -Path $StageDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
