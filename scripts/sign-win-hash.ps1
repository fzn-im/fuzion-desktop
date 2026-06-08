#Requires -Version 5.1
<#
.SYNOPSIS
  Update sha512 (and size) in electron-updater YAML manifests after signing.

.DESCRIPTION
  Signing changes the installer bytes, so dev.yml / latest.yml hashes become stale.
  Recomputes the sha512 digest for the Windows installer and patches any manifest
  that exists under the dist directory.

  Supported manifest names: dev.yml, dev.yaml, latest.yml, latest.yaml

.EXAMPLE
  .\scripts\sign-win.ps1 -File dist\fuzion-installer.exe
  .\scripts\sign-win-hash.ps1
#>

[CmdletBinding()]
param(
    [string] $Installer = $(if ($env:SIGN_HASH_INSTALLER) { $env:SIGN_HASH_INSTALLER }),
    [string] $DistDirectory = $(if ($env:SIGN_HASH_DIST) { $env:SIGN_HASH_DIST })
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($DistDirectory)) {
    $DistDirectory = Join-Path $repoRoot 'dist'
}
elseif (-not [System.IO.Path]::IsPathRooted($DistDirectory)) {
    $DistDirectory = Join-Path $repoRoot $DistDirectory
}

if ([string]::IsNullOrWhiteSpace($Installer)) {
    $Installer = Join-Path $DistDirectory 'fuzion-installer.exe'
}
elseif (-not [System.IO.Path]::IsPathRooted($Installer)) {
    $Installer = Join-Path $repoRoot $Installer
}

if (-not (Test-Path -LiteralPath $Installer -PathType Leaf)) {
    throw "Installer not found: $Installer"
}

$installerPath = (Resolve-Path -LiteralPath $Installer).Path
$installerInfo = Get-Item -LiteralPath $installerPath
$installerBytes = [System.IO.File]::ReadAllBytes($installerPath)
$sha512 = [System.Security.Cryptography.SHA512]::Create()
try {
    $hashBase64 = [Convert]::ToBase64String($sha512.ComputeHash($installerBytes))
}
finally {
    $sha512.Dispose()
}

$manifestNames = @('dev.yml', 'dev.yaml', 'latest.yml', 'latest.yaml')
$updated = @()

foreach ($name in $manifestNames) {
    $manifestPath = Join-Path $DistDirectory $name
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        continue
    }

    $content = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8
    $newContent = $content -replace '(?m)^(\s*sha512:\s*).+$', "`${1}$hashBase64"
    $newContent = $newContent -replace '(?m)^(\s*size:\s*)\d+$', "`${1}$($installerInfo.Length)"

    if ($newContent -eq $content) {
        Write-Warning "No sha512 or size fields updated in $manifestPath"
        continue
    }

    [System.IO.File]::WriteAllText($manifestPath, $newContent, [System.Text.UTF8Encoding]::new($false))
    $updated += $manifestPath
    Write-Host "Updated $manifestPath"
}

if ($updated.Count -eq 0) {
    Write-Host "No dev or latest YAML manifests found in $DistDirectory; nothing to update."
}
else {
    Write-Host "Installer: $installerPath"
    Write-Host "  size:   $($installerInfo.Length)"
    Write-Host "  sha512: $hashBase64"
}
