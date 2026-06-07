# ====================================================================
#  run-build-smoke.ps1  -  Leather Studio 3D desktop-build smoke
#
#  Fast STATIC checks (no compile) that the Tauri wrapper and index.html
#  agree: version strings in sync, build.rs copies the frontend + vendor,
#  the Rust<->JS command/event contract matches, capabilities declared,
#  and the app uses classic (non-module) scripts so file:// works.
#
#  Standalone; uses NO Claude credits/context.
#    powershell -File tests\run-build-smoke.ps1
#  Exit code 0 = all passed, 1 = a check failed.
# ====================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$tauri = Join-Path $root 'desktop\src-tauri'

$pass = 0; $fail = 0
function Check($name, $cond, $detail) {
  if ($cond) { Write-Host ("  PASS  " + $name) -ForegroundColor Green; $script:pass++ }
  else { $line = "  FAIL  " + $name; if ($detail) { $line += "  ($detail)" }; Write-Host $line -ForegroundColor Red; $script:fail++ }
}

$index    = Get-Content (Join-Path $root 'index.html') -Raw
$conf     = Get-Content (Join-Path $tauri 'tauri.conf.json') -Raw | ConvertFrom-Json
$cargo    = Get-Content (Join-Path $tauri 'Cargo.toml') -Raw
$buildrs  = Get-Content (Join-Path $tauri 'build.rs') -Raw
$mainrs   = Get-Content (Join-Path $tauri 'src\main.rs') -Raw
$caps     = Get-Content (Join-Path $tauri 'capabilities\default.json') -Raw
$ledger   = Get-Content (Join-Path $root 'desktop\build-info.json') -Raw | ConvertFrom-Json

Write-Host ""
Write-Host "  Leather Studio 3D - build smoke" -ForegroundColor Cyan
Write-Host "  -------------------------------------------------"

# --- version sync ---
$appVer = if ($index -match "APP_VERSION\s*=\s*'v([0-9.]+)'") { $matches[1] } else { '?' }
$cargoVer = if ($cargo -match '(?m)^version\s*=\s*"([0-9.]+)"') { $matches[1] } else { '?' }
Check "index APP_VERSION present" ($appVer -ne '?') $appVer
Check "tauri.conf version == APP_VERSION" ($conf.version -eq $appVer) "$($conf.version) vs $appVer"
Check "Cargo.toml version == APP_VERSION" ($cargoVer -eq $appVer) "$cargoVer vs $appVer"
Check "build-info devVersion == APP_VERSION" ($ledger.devVersion -eq $appVer) "$($ledger.devVersion) vs $appVer"

# --- frontend uses classic scripts (file:// safe), not ES modules ---
Check "no type=module in index.html" (-not ($index -match 'type\s*=\s*"module"')) "ES modules break over file://"
Check "vendors three.min.js (classic)" ($index -match 'vendor/three\.min\.js')
Check "vendors classic OrbitControls" ($index -match 'vendor/OrbitControls\.classic\.js')
Check "vendor files exist on disk" ((Test-Path (Join-Path $root 'vendor\three.min.js')) -and (Test-Path (Join-Path $root 'vendor\OrbitControls.classic.js')))

# --- build.rs syncs the frontend + vendor into dist ---
Check "build.rs copies index.html" ($buildrs -match 'index\.html')
Check "build.rs copies vendor/" ($buildrs -match 'vendor')

# --- Rust <-> JS contract ---
Check "main.rs defines take_launch_file" ($mainrs -match 'fn take_launch_file')
Check "main.rs registers take_launch_file" ($mainrs -match 'generate_handler!\[\s*take_launch_file')
Check "frontend invokes take_launch_file" ($index -match "invoke\('take_launch_file'\)")
Check "main.rs emits open-lpd" ($mainrs -match '"open-lpd"')
Check "frontend listens open-lpd" ($index -match "listen\('open-lpd'")
Check "single-instance plugin wired" ($mainrs -match 'single_instance')

# --- capabilities + bundle ---
Check "capabilities has core:default" ($caps -match 'core:default')
Check "bundle target nsis" ($conf.bundle.targets -contains 'nsis')
Check "does NOT hijack .lpd association" (-not ($conf.bundle.PSObject.Properties.Name -contains 'fileAssociations')) "LPD owns .lpd"

# --- auto-update / signing ---
$wf = Join-Path $root '.github\workflows\release.yml'
Check "createUpdaterArtifacts on" ($conf.bundle.createUpdaterArtifacts -eq $true)
Check "updater pubkey present" ([string]$conf.plugins.updater.pubkey -ne '')
Check "updater endpoint -> this repo latest.json" ([string]$conf.plugins.updater.endpoints -match 'leather-studio-3d/releases/latest/download/latest.json')
Check "Cargo: tauri-plugin-updater" ($cargo -match 'tauri-plugin-updater')
Check "Cargo: tauri-plugin-process" ($cargo -match 'tauri-plugin-process')
Check "Cargo: serde_json (generate_context)" ($cargo -match 'serde_json')
Check "main.rs registers updater plugin" ($mainrs -match 'tauri_plugin_updater')
Check "main.rs registers process plugin" ($mainrs -match 'tauri_plugin_process')
Check "capabilities has updater:default" ($caps -match 'updater:default')
Check "capabilities has process:default" ($caps -match 'process:default')
Check "frontend has checkForUpdates" ($index -match 'function checkForUpdates')
Check "frontend Help > Check for Updates item" ($index -match 'id="mi-update"')
Check "frontend uses updater.check + relaunch" (($index -match 'updater') -and ($index -match 'relaunch'))
Check "release workflow exists" (Test-Path $wf)
if (Test-Path $wf) {
  $w = Get-Content $wf -Raw
  Check "workflow signs (TAURI_SIGNING_PRIVATE_KEY)" ($w -match 'TAURI_SIGNING_PRIVATE_KEY')
  Check "workflow seeds vendor/ too" ($w -match 'vendor')
  Check "workflow projectPath desktop/src-tauri" ($w -match 'projectPath:\s*desktop/src-tauri')
}

Write-Host "  -------------------------------------------------"
$total = $pass + $fail
$color = if ($fail -eq 0) { 'Green' } else { 'Red' }
Write-Host ("  {0}/{1} passed, {2} failed" -f $pass, $total, $fail) -ForegroundColor $color
Write-Host ""
exit ([int]($fail -ne 0))
