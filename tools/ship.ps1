<#
  ship.ps1 - one-call release for the Leather apps (Leather Pattern Designer / Leather Studio 3D).

  This is the MECHANICAL half of "shipit": mint the build tag, sync the version into every
  build-critical file, run both smoke suites (hard gate), build + sign the installer (pre-flight
  gate), then commit + push + trigger release.yml. The HUMAN decides -Version and writes the DEVLOG
  entry first; this script does the rest. It is identical in both repos and auto-derives the
  repo-specific bits (package name, GitHub repo, signing key) so a fresh checkout can release itself.

  Run from the repo root (or anywhere - it cd's to the repo root itself):

    tools\ship.ps1 -Version 0.8.12 -Note "fix stitch spacing"
    tools\ship.ps1 -Version 0.8.12 -Note "wip" -DryRun            # build but DO NOT release
    tools\ship.ps1 -Version 0.8.12 -Note "wip" -DryRun -SkipBuild # fastest dry check (no build)

  Prereqs (same as the manual flow): on branch main, working tree holds the finished change +
  DEVLOG entry, signing key at %USERPROFILE%\.tauri\<package-name>.key (+ .password.txt), gh authed.
  Only hard stop is a failing smoke or build - it never releases red.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidatePattern('^\d+\.\d+\.\d+$')][string]$Version,
  [Parameter(Mandatory)][string]$Note,
  [switch]$DryRun,
  [switch]$SkipBuild
)
$ErrorActionPreference = 'Stop'

# --- helpers ---------------------------------------------------------------
function Fail($m){ Write-Host "  SHIP FAILED: $m" -ForegroundColor Red; exit 1 }
function Step($m){ Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function ReadText($p){ [System.IO.File]::ReadAllText($p) }
function WriteText($p,$t){ [System.IO.File]::WriteAllText($p, $t, (New-Object System.Text.UTF8Encoding $false)) }
# regex-replace in a file; -Required => fail if the pattern is not present.
function Sub($path, $pattern, $replacement, [switch]$Required){
  if(-not (Test-Path $path)){ if($Required){ Fail "missing file $path" }; return }
  $t = ReadText $path
  if(-not [regex]::IsMatch($t, $pattern)){ if($Required){ Fail "version pattern not found in $path" }; return }
  $n = [regex]::Replace($t, $pattern, $replacement)
  if($n -ne $t){ WriteText $path $n; Write-Host "    updated $path" }
  else { Write-Host "    ok, already current: $path" }
}

# --- 0. locate repo + sanity -----------------------------------------------
$root = Split-Path -Parent $PSScriptRoot     # tools\.. = repo root
Set-Location $root
# CRITICAL: Set-Location only moves PowerShell's $PWD. [System.IO.File] (ReadText/WriteText below)
# resolves relative paths against [Environment]::CurrentDirectory, which Set-Location does NOT sync,
# so without this the file edits would land in whatever dir the shell launched in - not this repo.
[Environment]::CurrentDirectory = (Get-Location).Path
if(-not (Test-Path "desktop\src-tauri\Cargo.toml")){ Fail "not a Leather app repo root (no desktop\src-tauri\Cargo.toml)" }
$branch = (& git rev-parse --abbrev-ref HEAD).Trim()
if($LASTEXITCODE -ne 0){ Fail "not a git repo" }
if($branch -ne 'main'){ Fail "not on main (on '$branch') - release flow pushes to main" }

# --- 1. derive identity (package / repo / signing key) ---------------------
$cargo = ReadText "desktop\src-tauri\Cargo.toml"
if($cargo -notmatch '(?m)^name = "([^"]+)"'){ Fail "no package name in Cargo.toml" }
$pkg = $Matches[1]
$remote = (& git remote get-url origin).Trim()
if($remote -match 'github\.com[:/]+([^/]+/[^/.]+)'){ $repo = $Matches[1] } else { Fail "cannot parse GitHub repo from origin '$remote'" }
$keyFile = Join-Path $env:USERPROFILE ".tauri\$pkg.key"
$pwFile  = "$keyFile.password.txt"
if(-not (Test-Path $keyFile)){ Fail "signing key not found: $keyFile" }
if(-not (Test-Path $pwFile)){ Fail "signing password not found: $pwFile" }
Write-Host "  package : $pkg"
Write-Host "  repo    : $repo"

# --- 2. mint build tag (buildCount+1, two fresh random words) --------------
$biPath = "desktop\build-info.json"
$bi = ReadText $biPath
if($bi -notmatch '"buildCount"\s*:\s*(\d+)'){ Fail "no buildCount in build-info.json" }
$newCount = [int]$Matches[1] + 1
if($bi -notmatch '"buildTag"\s*:\s*"([^"]+)"'){ Fail "no buildTag in build-info.json" }
$oldTag = $Matches[1]
$usedStems = @([regex]::Matches($bi, '"tag"\s*:\s*"([^"]+)"') | ForEach-Object { ($_.Groups[1].Value -replace '-V\d+$','') })
$adj = 'amber','azure','cobalt','crimson','dusky','ember','golden','hazel','indigo','jade','maple','mossy','ochre','russet','saffron','scarlet','slate','tawny','teal','umber','verdant','violet','willow'
$ani = 'badger','bittern','curlew','egret','falcon','finch','godwit','grebe','heron','kestrel','lynx','marten','merlin','osprey','otter','pika','plover','quail','raven','shrike','stoat','stork','tanager','tern','vireo','wren'
do { $stem = ($adj | Get-Random) + '-' + ($ani | Get-Random) } while ($usedStems -contains $stem)
$tag = "$stem-V$newCount"
Write-Host "  new tag : $tag   (dev v$Version)"

# --- 3. sync version strings (anchored, single-purpose) --------------------
Step "Syncing version -> v$Version, build tag -> $tag"
# index.html (APP_VERSION always; BUILD_TAG + #app-title only where present)
Sub "index.html" "const APP_VERSION = '[^']*';" ("const APP_VERSION = 'v" + $Version + "';") -Required
Sub "index.html" "const BUILD_TAG = '[^']*';" ("const BUILD_TAG = '" + $tag + "';")
Sub "index.html" '(<div id="app-title">Leather Pattern Designer )v[0-9.]+(</div>)' ('${1}v' + $Version + '${2}')
# Cargo.toml + Cargo.lock (the package's own version block)
$verPat = '(?m)(^name = "' + [regex]::Escape($pkg) + '"\r?\nversion = ")[^"]*(")'
Sub "desktop\src-tauri\Cargo.toml" $verPat ('${1}' + $Version + '${2}') -Required
Sub "desktop\src-tauri\Cargo.lock" $verPat ('${1}' + $Version + '${2}') -Required
# tauri.conf.json (single top-level "version")
Sub "desktop\src-tauri\tauri.conf.json" '("version": ")[^"]*(")' ('${1}' + $Version + '${2}') -Required
# docs - version number only (the DEVLOG prose entry stays manual)
Sub "MD files\CONTEXT.md" 'Current version: v[0-9.]+' ("Current version: v" + $Version)
Sub "MD files\SHORTCUTS.md" '(?m)^_v[0-9.]+_$' ("_v" + $Version + "_")

# build-info.json: devVersion / buildCount / buildTag + append a history entry (string-surgery so
# the hand-formatted file keeps its shape; the new entry goes right after the previous last one).
$noteEsc = ($Note -replace '\\','\\\\') -replace '"','\"'
$today = Get-Date -Format 'yyyy-MM-dd'
$bi = $bi -replace '("devVersion"\s*:\s*")[^"]*(")', ('${1}' + $Version + '${2}')
$bi = $bi -replace '("buildCount"\s*:\s*)\d+', ('${1}' + $newCount)
$bi = $bi -replace '("buildTag"\s*:\s*")[^"]*(")', ('${1}' + $tag + '${2}')
$entry = '{ "v": ' + $newCount + ', "tag": "' + $tag + '", "dev": "' + $Version + '", "date": "' + $today + '", "note": "' + $noteEsc + '" }'
$mi = $bi.IndexOf('"tag": "' + $oldTag + '"')
if($mi -lt 0){ Fail "could not locate previous history entry ($oldTag) in build-info.json" }
$ci = $bi.IndexOf('}', $mi)
if($ci -lt 0){ Fail "malformed build-info.json history" }
$bi = $bi.Substring(0, $ci+1) + ",`r`n    " + $entry + $bi.Substring($ci+1)
WriteText $biPath $bi
Write-Host "    updated $biPath"

# --- 4. smoke (HARD gate) - run each in its own process so its `exit` can't kill us ----
Step "Smoke: app (full)"
& powershell -NoProfile -ExecutionPolicy Bypass -File "tests\run-smoke.ps1" -Tier full
if($LASTEXITCODE -ne 0){ Fail "app smoke failed - not releasing" }
Step "Smoke: desktop build wiring"
& powershell -NoProfile -ExecutionPolicy Bypass -File "tests\run-build-smoke.ps1"
if($LASTEXITCODE -ne 0){ Fail "build smoke failed - not releasing" }

# --- 5. build + sign (pre-flight gate; CI rebuilds+signs+publishes) --------
if($SkipBuild){ Step "Skipping build (-SkipBuild)" }
else {
  Step "Building signed installer (cargo tauri build)"
  $env:TAURI_SIGNING_PRIVATE_KEY = (ReadText $keyFile).Trim()
  $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = (ReadText $pwFile).TrimStart([char]0xFEFF).Trim()
  Push-Location "desktop\src-tauri"
  & cargo tauri build
  $bc = $LASTEXITCODE
  Pop-Location
  $env:TAURI_SIGNING_PRIVATE_KEY = $null; $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = $null
  if($bc -ne 0){ Fail "cargo tauri build failed" }
  $setup = Get-ChildItem "desktop\src-tauri\target\release\bundle\nsis\*_$($Version)_*-setup.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if($setup){ Write-Host "    built $($setup.FullName)" }
}

# --- 6. release (skipped on -DryRun) ---------------------------------------
if($DryRun){
  Step "DryRun complete - stopping before commit/push/release"
  Write-Host "  Minted: v$Version ($tag).  Inspect with: git diff" -ForegroundColor Yellow
  Write-Host "  Discard the dry-run edits with: git checkout -- ." -ForegroundColor Yellow
  exit 0
}
Step "Commit + push + trigger release"
& git add -u
if($LASTEXITCODE -ne 0){ Fail "git add -u failed" }
& git add "tools\ship.ps1"                       # ensure the script itself is tracked
$msg = "v$Version ($tag): $Note`n`nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
& git commit -m $msg
if($LASTEXITCODE -ne 0){ Fail "git commit failed (nothing staged?)" }
& git push origin main
if($LASTEXITCODE -ne 0){ Fail "git push failed" }
& gh workflow run release.yml -R $repo --ref main
if($LASTEXITCODE -ne 0){ Fail "gh workflow run failed" }

# --- 7. report -------------------------------------------------------------
Step "Released v$Version ($tag) -> $repo"
Start-Sleep -Seconds 3
& gh run list -R $repo --workflow release.yml --limit 1
Write-Host ""
Write-Host "  Done. CI (tauri-action) is building/signing/publishing the release + latest.json." -ForegroundColor Green
