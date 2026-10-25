# Generic Project PowerShell Profile
param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectName
)

# Get project root (assume we're running from project directory)
$ProjectRoot = Get-Location

# Set project-specific history file
$ProjectHistoryPath = Join-Path $ProjectRoot "PowerShell_History.txt"
Set-PSReadLineOption -HistorySavePath $ProjectHistoryPath

# Set window title
$Host.UI.RawUI.WindowTitle = "PowerShell - $ProjectName"

# Auto-detect and create aliases for npm scripts
$NpmScripts = @()
$PackageJsonPath = Join-Path $ProjectRoot "package.json"
if (Test-Path $PackageJsonPath) {
    try {
        $PackageJson = Get-Content $PackageJsonPath | ConvertFrom-Json
        if ($PackageJson.scripts) {
            $NpmScripts = $PackageJson.scripts.PSObject.Properties.Name
        }
    }
    catch {
        Write-Warning "Could not parse package.json"
    }
}

# Create functions for npm scripts
foreach ($script in $NpmScripts) {
    $functionBody = "npm run $script"
    $functionScript = [ScriptBlock]::Create($functionBody)
    Set-Item -Path "function:global:$script" -Value $functionScript
}

# Display welcome message
Write-Host "$ProjectName PowerShell Profile Loaded" -ForegroundColor Green
Write-Host "Project Directory: $ProjectRoot" -ForegroundColor Cyan
Write-Host "History File: $ProjectHistoryPath" -ForegroundColor Cyan
Write-Host ""

if ($NpmScripts.Count -gt 0) {
    Write-Host "Available npm script aliases:" -ForegroundColor Yellow
    $NpmScripts | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
    Write-Host ""
}