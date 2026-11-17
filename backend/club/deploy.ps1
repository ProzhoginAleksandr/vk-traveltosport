param(
  [string]$FolderId = "",
  [string]$Secret = "",
  [string]$FunctionName = "club-stats",
  [string]$BucketName = "",
  [string]$ServiceAccountName = "club-stats"
)

$ErrorActionPreference = "Stop"

function Step([string]$Text) {
  Write-Host ""
  Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Yc {
  param([string[]]$YcArgs)
  $output = & yc $YcArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw (($output | Out-String).Trim()) }
  return $output
}

if (-not (Get-Command yc -ErrorAction SilentlyContinue)) {
  throw "yc CLI not found. Install it and run 'yc init' first."
}
if (-not (Get-Command tar -ErrorAction SilentlyContinue)) {
  throw "tar not found. Windows 10+ includes tar.exe."
}

if (-not $FolderId) {
  $FolderId = ((Yc -YcArgs @("config", "get", "folder-id")) | Out-String).Trim()
}
if (-not $FolderId) { throw "Folder id is empty. Run 'yc config set folder-id <id>'." }

if (-not $Secret) { $Secret = Read-Host "Paste the VK app secure key" }
if (-not $Secret) { throw "VK secure key is required." }

if (-not $BucketName) { $BucketName = "club-stats-data-$FolderId" }

$backendDir = $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $backendDir)
Set-Location $repoRoot

Step "1/5 Service account"
$saJson = & yc iam service-account get $ServiceAccountName --format json 2>$null
if ($LASTEXITCODE -ne 0) {
  Yc -YcArgs @("iam", "service-account", "create", "--name", $ServiceAccountName) | Out-Null
  $saJson = Yc -YcArgs @("iam", "service-account", "get", $ServiceAccountName, "--format", "json")
}
$serviceAccountId = ($saJson | Out-String | ConvertFrom-Json).id
if (-not $serviceAccountId) { throw "Cannot read the service account id." }
Write-Host "id: $serviceAccountId"

Step "2/5 Roles"
Yc -YcArgs @("resource-manager", "folder", "add-access-binding", $FolderId, "--role", "storage.editor", "--subject", "serviceAccount:$serviceAccountId") | Out-Null
Yc -YcArgs @("resource-manager", "folder", "add-access-binding", $FolderId, "--role", "functions.functionInvoker", "--subject", "serviceAccount:$serviceAccountId") | Out-Null
Write-Host "storage.editor and functions.functionInvoker granted"

Step "3/5 Bucket"
$bucketJson = & yc storage bucket get --name $BucketName --format json 2>$null
if ($LASTEXITCODE -ne 0) {
  Yc -YcArgs @("storage", "bucket", "create", "--name", $BucketName, "--folder-id", $FolderId) | Out-Null
}
Write-Host "bucket: $BucketName"

Step "4/5 Function archive"
Push-Location $backendDir
try {
  if (Test-Path "club.zip") { Remove-Item "club.zip" -Force }
  tar -a -c -f club.zip index.js auth.js storage.js
} finally {
  Pop-Location
}
$zipPath = Join-Path $backendDir "club.zip"
Write-Host "archive: $zipPath"

Step "5/5 Function version"
$fnJson = & yc serverless function get $FunctionName --format json 2>$null
if ($LASTEXITCODE -ne 0) {
  Yc -YcArgs @("serverless", "function", "create", "--name", $FunctionName) | Out-Null
}
$envLine = "VK_APP_SECRET=$Secret,CLUB_BUCKET=$BucketName"
$versionArgs = @(
  "serverless", "function", "version", "create",
  "--function-name", $FunctionName,
  "--runtime", "nodejs18",
  "--entrypoint", "index.handler",
  "--memory", "256MB",
  "--execution-timeout", "15s",
  "--service-account-id", $serviceAccountId,
  "--source-path", $zipPath,
  "--environment", $envLine
)
Yc -YcArgs $versionArgs | Out-Null
Yc -YcArgs @("serverless", "function", "allow-unauthenticated-invoke", $FunctionName) | Out-Null

$fn = (Yc -YcArgs @("serverless", "function", "get", $FunctionName, "--format", "json")) | Out-String | ConvertFrom-Json
$url = $fn.http_invoke_url
if (-not $url) { throw "Cannot read the function URL." }

Write-Host ""
Write-Host "Done. Function URL:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor Yellow
Write-Host ""
try {
  $month = Get-Date -Format 'yyyy-MM'
  $check = Invoke-RestMethod -Uri "$url`?month=$month" -TimeoutSec 20
  Write-Host ($check | ConvertTo-Json -Compress)
} catch {
  Write-Host "check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Next:"
Write-Host "1. GitHub -> Settings -> Secrets and variables -> Actions -> Variables"
Write-Host "2. Add VITE_CLUB_API_URL = $url"
Write-Host "3. Push to main; Pages rebuilds and the club block appears."
