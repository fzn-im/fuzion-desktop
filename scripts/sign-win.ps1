#Requires -Version 5.1
<#
.SYNOPSIS
  Sign Windows executables and DLLs using sign.exe and Azure Artifact Signing.

.DESCRIPTION
  Authenticates to Azure (interactive or service principal) and signs PE files
  under the dist directory with the dotnet sign CLI (sign.exe).

  Required environment variables:
    AZURE_ARTIFACT_SIGNING_ENDPOINT            e.g. https://wus2.codesigning.azure.net/
    AZURE_ARTIFACT_SIGNING_ACCOUNT              Artifact Signing account name
    AZURE_ARTIFACT_SIGNING_PROFILE             Certificate profile name

  Optional environment variables:
    AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET  Service principal auth (CI)
    SIGN_FILE                                  Path to a file or folder to sign (skips default dist/ search)
    SIGN_BASE_DIRECTORY                        Base path to search (default: dist/)
    SIGN_FILE_PATTERNS                         Space-separated globs (default: **/*.exe **/*.dll)
    SIGN_TIMESTAMP_URL                         RFC 3161 timestamp server (default: http://timestamp.acs.microsoft.com)
    SIGN_MAX_CONCURRENCY                       Parallel signing jobs (default: 10)
    SIGN_SKIP_AZ_LOGIN                         Set to 1 to skip az login (credentials already present)
    SIGN_VERIFY                                Set to 1 to run Get-AuthenticodeSignature after signing

.EXAMPLE
  $env:AZURE_ARTIFACT_SIGNING_ENDPOINT = "https://wus2.codesigning.azure.net/"
  $env:AZURE_ARTIFACT_SIGNING_ACCOUNT = "my-signing-account"
  $env:AZURE_ARTIFACT_SIGNING_PROFILE = "MyProfile"
  az login --scope "https://codesigning.azure.net/.default"
  .\scripts\sign-win.ps1

.EXAMPLE
  .\scripts\sign-win.ps1 -File dist\fuzion-installer.exe

.EXAMPLE
  .\scripts\sign-win.ps1 -File dist\win-unpacked
#>

[CmdletBinding()]
param(
    [string] $Endpoint = $env:AZURE_ARTIFACT_SIGNING_ENDPOINT,
    [string] $Account = $env:AZURE_ARTIFACT_SIGNING_ACCOUNT,
    [string] $Profile = $env:AZURE_ARTIFACT_SIGNING_PROFILE,
    [Alias('Path')]
    [string[]] $File = $(if ($env:SIGN_FILE) { @($env:SIGN_FILE) }),
    [string] $BaseDirectory = $env:SIGN_BASE_DIRECTORY,
    [string[]] $FilePatterns = $(if ($env:SIGN_FILE_PATTERNS) { $env:SIGN_FILE_PATTERNS -split '\s+' } else { @('**/*.exe', '**/*.dll') }),
    [string] $TimestampUrl = $(if ($env:SIGN_TIMESTAMP_URL) { $env:SIGN_TIMESTAMP_URL } else { 'http://timestamp.acs.microsoft.com' }),
    [int] $MaxConcurrency = $(if ($env:SIGN_MAX_CONCURRENCY) { [int]$env:SIGN_MAX_CONCURRENCY } else { 10 }),
    [switch] $SkipAzLogin = [bool]($env:SIGN_SKIP_AZ_LOGIN -eq '1'),
    [switch] $Verify = [bool]($env:SIGN_VERIFY -eq '1')
)

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([string] $Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found on PATH: $Name"
    }
}

function Require-Value {
    param([string] $Name, [string] $Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Missing required value: $Name (set the corresponding environment variable or parameter)."
    }
}

function Resolve-ExplicitFiles {
    param(
        [string[]] $Paths,
        [string[]] $Patterns
    )

    $repoRoot = Split-Path -Parent $PSScriptRoot
    $files = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

    foreach ($path in $Paths) {
        if ([string]::IsNullOrWhiteSpace($path)) {
            continue
        }

        $resolved = if ([System.IO.Path]::IsPathRooted($path)) {
            $path
        }
        else {
            Join-Path $repoRoot $path
        }

        if (-not (Test-Path -LiteralPath $resolved)) {
            throw "Path not found: $path"
        }

        if (Test-Path -LiteralPath $resolved -PathType Container) {
            $dirPath = (Resolve-Path -LiteralPath $resolved).Path
            $dirFiles = Resolve-SignableFiles -Root $dirPath -Patterns $Patterns
            foreach ($file in $dirFiles) {
                [void]$files.Add($file)
            }
        }
        else {
            [void]$files.Add((Resolve-Path -LiteralPath $resolved).Path)
        }
    }

    if ($files.Count -eq 0) {
        throw "No signable files found in: $($Paths -join ', ')"
    }

    return @($files | Sort-Object)
}

function Resolve-SignableFiles {
    param(
        [string] $Root,
        [string[]] $Patterns
    )

    $files = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)

    foreach ($pattern in $Patterns) {
        $normalized = $pattern -replace '\\', '/'
        if ($normalized -match '^\*\*/(.+)$') {
            $filter = $Matches[1]
            Get-ChildItem -Path $Root -Recurse -File -Filter $filter -ErrorAction SilentlyContinue |
                ForEach-Object { [void]$files.Add($_.FullName) }
        }
        elseif ($normalized -match '[\*\?]') {
            Get-ChildItem -Path (Join-Path $Root $pattern) -File -ErrorAction SilentlyContinue |
                ForEach-Object { [void]$files.Add($_.FullName) }
        }
        else {
            $path = if ([System.IO.Path]::IsPathRooted($pattern)) { $pattern } else { Join-Path $Root $pattern }
            if (Test-Path -LiteralPath $path -PathType Leaf) {
                [void]$files.Add((Resolve-Path -LiteralPath $path).Path)
            }
        }
    }

    return @($files | Sort-Object)
}

Require-Command 'sign'
Require-Command 'az'

Require-Value 'Endpoint (-Endpoint / AZURE_ARTIFACT_SIGNING_ENDPOINT)' $Endpoint
Require-Value 'Account (-Account / AZURE_ARTIFACT_SIGNING_ACCOUNT)' $Account
Require-Value 'Profile (-Profile / AZURE_ARTIFACT_SIGNING_PROFILE)' $Profile

$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $SkipAzLogin) {
    $tenantId = $env:AZURE_TENANT_ID
    $clientId = $env:AZURE_CLIENT_ID
    $clientSecret = $env:AZURE_CLIENT_SECRET

    if ($tenantId -and $clientId -and $clientSecret) {
        Write-Host "Logging in with Azure service principal..."
        az login `
            --service-principal `
            --username $clientId `
            --password $clientSecret `
            --tenant $tenantId `
            --scope "https://codesigning.azure.net/.default" `
            --output none
    }
    else {
        Write-Host "Logging in interactively (device code)..."
        Write-Host "You need the Artifact Signing Certificate Profile Signer role on the signing account."
        az login --use-device-code --scope "https://codesigning.azure.net/.default" --output none
    }
}

if ($File -and $File.Count -gt 0) {
    $filesToSign = Resolve-ExplicitFiles -Paths $File -Patterns $FilePatterns
    $signSource = "explicit path(s)"
}
else {
    if ([string]::IsNullOrWhiteSpace($BaseDirectory)) {
        $BaseDirectory = Join-Path $repoRoot 'dist'
    }

    $BaseDirectory = (Resolve-Path $BaseDirectory).Path
    $filesToSign = Resolve-SignableFiles -Root $BaseDirectory -Patterns $FilePatterns
    if ($filesToSign.Count -eq 0) {
        throw "No files matched under $BaseDirectory with patterns: $($FilePatterns -join ', ')"
    }

    $signSource = $BaseDirectory
}

Write-Host "Signing $($filesToSign.Count) file(s) from: $signSource"
Write-Host "  Endpoint:  $Endpoint"
Write-Host "  Account:   $Account"
Write-Host "  Profile:   $Profile"
Write-Host "  Timestamp: $TimestampUrl"

$signArgs = @(
    'code', 'artifact-signing',
    '--verbosity', 'warning',
    '--timestamp-url', $TimestampUrl,
    '--artifact-signing-endpoint', $Endpoint.TrimEnd('/'),
    '--artifact-signing-account', $Account,
    '--artifact-signing-certificate-profile', $Profile,
    '--max-concurrency', $MaxConcurrency
) + $filesToSign

& sign @signArgs
if ($LASTEXITCODE -ne 0) {
    throw "sign.exe failed with exit code $LASTEXITCODE"
}

if ($Verify) {
    Write-Host "`nVerifying signatures..."
    foreach ($file in $filesToSign) {
        $result = Get-AuthenticodeSignature $file
        Write-Host "$file`: $($result.Status)"
    }
}

Write-Host "Signing complete."
