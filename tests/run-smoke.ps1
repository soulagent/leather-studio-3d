# ====================================================================
#  run-smoke.ps1  -  Leather Studio 3D smoke-test runner
#
#  Injects tests/smoke-harness.js into a copy of index.html, runs it in
#  headless Edge, reads the JSON results back out of the DOM, and prints
#  a PASS/FAIL report. Exit code 0 = all passed, 1 = a test failed.
#
#  Standalone: needs only Edge + the repo. Uses NO Claude credits/context.
#  Double-click run-smoke.cmd, or:
#    powershell -File tests\run-smoke.ps1 -Tier quick
#    powershell -File tests\run-smoke.ps1 -Tier full
#    powershell -File tests\run-smoke.ps1 -Feature "outline,stitch-path"
#
#  NOTE: this app renders with WebGL (three.js). The kernel functions the
#  harness drives are defined AFTER the WebGLRenderer is created, so the
#  page needs a working GL context. Headless Edge has none by default, so
#  we force software GL via SwiftShader (the --use-angle flags below).
# ====================================================================
param(
  [string]$Tier = 'quick',
  [string]$Feature = ''
)
# A feature list (if given) overrides the tier. Passed straight to the harness,
# which resolves tier names ('quick'/'full') and comma/space feature lists.
# Available features: kernel outline stitch-rect stitch-circle stitch-path
#   stitch-edges load nostitch
$Spec = if ($Feature) { $Feature } else { $Tier }

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot          # project root (parent of tests\)
$index = Join-Path $root 'index.html'
$harness = Join-Path $PSScriptRoot 'smoke-harness.js'
# IMPORTANT: write the instrumented page to the PROJECT ROOT, not tests/, so the
# app's relative vendor paths (./vendor/three.min.js) resolve. (LPD's runner can
# use tests/ because that app has no external scripts; this one does.)
$tmp = Join-Path $root '_run.html'

if (-not (Test-Path $index)) { Write-Error "index.html not found at $index"; exit 2 }
if (-not (Test-Path $harness)) { Write-Error "smoke-harness.js not found at $harness"; exit 2 }

# Locate Edge
$edge = @(
  "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
  "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Error "Microsoft Edge not found."; exit 2 }

# Build the instrumented page: index.html + harness + invocation, before </body>
$html = Get-Content $index -Raw -Encoding UTF8
$js = Get-Content $harness -Raw -Encoding UTF8
$inject = "<script>`n$js`nwindow.__SMOKE__('$Spec');`n</script>`n</body>"
if ($html -notmatch '</body>') { Write-Error "No </body> in index.html"; exit 2 }
# Use literal String.Replace, NOT the -replace operator: -replace is regex and
# would treat the harness's ${...} template literals as substitution tokens and
# corrupt the injected JS.
$instrumented = $html.Replace('</body>', $inject)
Set-Content -Path $tmp -Value $instrumented -Encoding UTF8

# Run headless Edge, dump the DOM. Software GL (SwiftShader) so three.js inits.
$uri = ([System.Uri]$tmp).AbsoluteUri
$outFile = Join-Path $PSScriptRoot '_dump.out'
$errFile = Join-Path $PSScriptRoot '_dump.err'
$edgeArgs = @(
  '--headless=new', '--no-sandbox', '--no-first-run',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  "--user-data-dir=$env:TEMP\ls3d-smoke-profile", '--dump-dom', $uri
)
Start-Process -FilePath $edge -ArgumentList $edgeArgs -Wait -NoNewWindow `
  -RedirectStandardOutput $outFile -RedirectStandardError $errFile
$dump = if (Test-Path $outFile) { Get-Content $outFile -Raw -Encoding UTF8 } else { '' }

Remove-Item $tmp, $outFile, $errFile -Force -ErrorAction SilentlyContinue

# Extract the JSON payload
$m = [regex]::Match($dump, '__SMOKE_JSON__(?<j>.*?)__END__', 'Singleline')
if (-not $m.Success) {
  Write-Host "FATAL: smoke harness produced no output (page failed to run)." -ForegroundColor Red
  Write-Host "--- first 600 chars of DOM dump ---"
  Write-Host ($dump.Substring(0, [Math]::Min(600, $dump.Length)))
  exit 1
}

$data = $m.Groups['j'].Value | ConvertFrom-Json

# Report
Write-Host ""
Write-Host "  Leather Studio 3D - smoke test [$($data.tier)]" -ForegroundColor Cyan
Write-Host "  ----------------------------------------------------"
foreach ($r in $data.results) {
  if ($r.pass) {
    Write-Host ("  PASS  " + $r.name) -ForegroundColor Green
  }
  else {
    $line = "  FAIL  " + $r.name
    if ($r.detail) { $line += "  ($($r.detail))" }
    Write-Host $line -ForegroundColor Red
  }
}
Write-Host "  ----------------------------------------------------"
$color = if ($data.failed -eq 0) { 'Green' } else { 'Red' }
Write-Host ("  {0}/{1} passed, {2} failed" -f $data.passed, $data.total, $data.failed) -ForegroundColor $color
if ($data.aborted) {
  Write-Host "  HARNESS ABORTED:" -ForegroundColor Red
  Write-Host ("  " + $data.aborted)
}
Write-Host ""

exit ([int]($data.failed -ne 0))
