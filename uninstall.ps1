# qBit Mobile uninstaller for Windows.
# Stops and unregisters the Scheduled Task, then removes the install dir.

#Requires -Version 7.0

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$AppDir   = Join-Path $env:LOCALAPPDATA 'qbit-mobile'
$LogFile  = Join-Path $AppDir 'logs\qbit-mobile.log'
$TaskName = 'qbit-mobile'

function Write-Msg  { param([string]$Text) Write-Host "[+] $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "[*] $Text" -ForegroundColor Yellow }
function Write-Err  { param([string]$Text) Write-Host "[!] $Text" -ForegroundColor Red }

Write-Warn "This will completely remove qBit Mobile from this machine."
$reply = (Read-Host 'Are you sure you want to continue? (y/N)').Trim()
if ($reply -notmatch '^[Yy]') {
    Write-Msg "Uninstall cancelled."
    exit 0
}

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Write-Msg "Stopping scheduled task..."
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Write-Msg "Unregistering scheduled task..."
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

# Also clean up any lingering node.exe instances running our server.js.
# (Scheduled Tasks normally stop the process on unregister, but a stuck
# task instance can leave the child alive.)
$ourServer = Join-Path $AppDir 'server\server.js'
$leftovers = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ourServer*" }
foreach ($p in $leftovers) {
    Write-Msg "Terminating leftover node.exe (pid $($p.ProcessId))..."
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

if (Test-Path $AppDir) {
    Write-Msg "Removing application directory..."
    Remove-Item -Path $AppDir -Recurse -Force
}

Write-Msg ""
Write-Msg "========================================="
Write-Msg "qBit Mobile has been completely removed!"
Write-Msg ""
Write-Msg "Removed:"
Write-Msg "  - Scheduled task: $TaskName"
Write-Msg "  - Application: $AppDir"
Write-Msg "========================================="
