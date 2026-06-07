@echo off
REM ====================================================================
REM  run-smoke.cmd - double-click launcher for the smoke tests.
REM  Double-click in Explorer (or run from a terminal). Pick a tier,
REM  it runs tests\run-smoke.ps1 and keeps the window open for results.
REM ====================================================================
setlocal
cd /d "%~dp0"

echo.
echo   Leather Studio 3D - smoke test
echo   ==============================
echo     [Q] quick  (kernel + outline)
echo     [F] full   (every feature incl. stitch + 3D load)
echo.

set "tier=quick"
set /p "choice=  Tier (Q/F) [Q]: "
if /i "%choice%"=="F" set "tier=full"

echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "tests\run-smoke.ps1" -Tier %tier%
set "code=%errorlevel%"

echo.
if "%code%"=="0" (
  echo   Result: ALL PASSED  ^(exit 0^)
) else (
  echo   Result: FAILURES  ^(exit %code%^)  - scroll up for the FAIL lines.
)
echo.
pause
endlocal
