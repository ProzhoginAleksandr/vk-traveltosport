param(
  [string]$FolderId = "",
  [string]$Secret = "",
  [string]$DbName = "club-db",
  [string]$FunctionName = "club-stats",
  [string]$TriggerName = "club-stats-http",
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
  if ($LASTEXITCODE -ne 0) {
    throw (($output | Out-String).Trim())
  }
  return $output
}

if (-not (Get-Command yc -ErrorAction SilentlyContinue)) {
  throw "yc CLI not found. Install it and run 'yc init' first: https://yandex.cloud/ru/docs/cli/operations/install-cli"
}

if (-not $FolderId) {
  $FolderId = ((Yc -YcArgs @("config", "get", "folder-id")) | Out-String).Trim()
}
if (-not $FolderId) {
  throw "Folder id is empty. Run 'yc config set folder-id <id>' or pass -FolderId <id>."
}

if (-not $Secret) {
  $Secret = Read-Host "Paste the VK app secure key"
}
if (-not $Secret) {
  throw "VK secure key is required to verify the launch signature."
}

$backendDir = $PSScriptRoot
$repoRoot = Split-Path -Parent (Split-Path -Parent $backendDir)
Set-Location $repoRoot

Step "1/6 Service account"
$saJson = & yc iam service-account get $ServiceAccountName --format json 2>$null
if ($LASTEXITCODE -ne 0) {
  Yc -YcArgs @("iam", "service-account", "create", "--name", $ServiceAccountName) | Out-Null
  $saJson = Yc -YcArgs @("iam", "service-account", "get", $ServiceAccountName, "--format", "json")
}
$serviceAccountId = ($saJson | Out-String | ConvertFrom-Json).id
if (-not $serviceAccountId) { throw "Cannot read the service account id." }
Write-Host "id: $serviceAccountId"

Step "2/6 Roles"
Yc -YcArgs @("resource-manager", "folder", "add-access-binding", $FolderId, "--role", "ydb.editor", "--subject", "serviceAccount:$serviceAccountId") | Out-Null
Yc -YcArgs @("resource-manager", "folder", "add-access-binding", $FolderId, "--role", "functions.functionInvoker", "--subject", "serviceAccount:$serviceAccountId") | Out-Null
Write-Host "ydb.editor and functions.functionInvoker granted"

Step "3/6 YDB database"
$dbJson = & yc ydb database get $DbName --format json 2>$null
if ($LASTEXITCODE -ne 0) {
  Yc -YcArgs @("ydb", "database", "create", $DbName, "--serverless") | Out-Null
}
$db = $null
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Seconds 5
  $dbJson = Yc -YcArgs @("ydb", "database", "get", $DbName, "--format", "json")
  $db = $dbJson | Out-String | ConvertFrom-Json
  if ($db.status -eq "RUNNING") { break }
  Write-Host "status: $($db.status)"
}
if (-not $db -or $db.status -ne "RUNNING") { throw "YDB database did not reach RUNNING." }
$endpoint = $db.endpoint
$database = $db.database
if (-not $endpoint -or -not $database) { throw "Cannot read YDB endpoint/database." }
Write-Host "endpoint: $endpoint"
Write-Host "database: $database"

Step "4/6 Function archive"
Push-Location $backendDir
try {
  if (-not (Test-Path "node_modules")) {
    npm install --omit=dev
  }
  if (Test-Path "club.zip") { Remove-Item "club.zip" -Force }
  Compress-Archive -Path index.js, auth.js, storage.js, node_modules -DestinationPath club.zip -Force
} finally {
  Pop-Location
}
$zipPath = Join-Path $backendDir "club.zip"
Write-Host "archive: $zipPath"

Step "5/6 Function version"
$fnJson = & yc serverless function get $FunctionName --format json 2>$null
if ($LASTEXITCODE -ne 0) {
  Yc -YcArgs @("serverless", "function", "create", "--name", $FunctionName) | Out-Null
}
$envLine = "VK_APP_SECRET=$Secret,YDB_ENDPOINT=$endpoint,YDB_DATABASE=$database,YDB_METADATA_CREDENTIALS=1"
$versionArgs = @(
  "serverless", "function", "version", "create",
  "--function-name", $FunctionName,
  "--runtime", "nodejs18",
  "--entry-point", "index.handler",
  "--memory", "256m",
  "--execution-timeout", "10s",
  "--service-account-id", $serviceAccountId,
  "--source-path", $zipPath,
  "--environment", $envLine
)
Yc -YcArgs $versionArgs | Out-Null
Write-Host "function version created"

Step "6/6 HTTP trigger"
$triggerJson = & yc serverless trigger get $TriggerName --format json 2>$null
if ($LASTEXITCODE -ne 0) {
  $triggerArgs = @(
    "serverless", "trigger", "create", "http",
    "--name", $TriggerName,
    "--invoke-function-name", $FunctionName,
    "--invoke-function-service-account-id", $serviceAccountId,
    "--invoke-function-tag", '$latest'
  )
  Yc -YcArgs $triggerArgs | Out-Null
  Start-Sleep -Seconds 5
  $triggerJson = Yc -YcArgs @("serverless", "trigger", "get", $TriggerName, "--format", "json")
}
$triggerText = $triggerJson | Out-String
$trigger = $triggerText | ConvertFrom-Json
$url = $trigger.http_trigger.url
if (-not $url) {
  $url = [regex]::Match($triggerText, 'https://[a-z0-9.-]+').Value
}
if (-not $url) { throw "Cannot read the trigger URL. Open the Yandex Cloud console." }

Write-Host ""
Write-Host "Done. Function URL:" -ForegroundColor Green
Write-Host "  $url" -ForegroundColor Yellow
Write-Host ""
Write-Host "Check:"
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
