---
description: Full smoke test for Leather Studio 3D (every feature)
---
Run the **full-tier** smoke test for Leather Studio 3D.

Execute this with the PowerShell tool from the project root:

```
& "tests\run-smoke.ps1" -Tier full
```

This injects `tests/smoke-harness.js` into a copy of `index.html`, runs it in
headless Edge (software GL via SwiftShader), and reports PASS/FAIL across the
geometry kernel, `outlinePolygon` (incl. the PEN-path regression), stitch-hole
generation (rect / circle / bezier path / per-edge), and the `.lpd` -> 3D
`loadPattern` pipeline (panel + stitch meshes, hidden-shape skip, clearScene).

For the desktop-build wiring (version sync, Rust<->JS contract), run instead:

```
& "tests\run-build-smoke.ps1"
```

After it runs, summarize the results. If any assertion FAILS, open `index.html`,
locate the function behind the failing assertion, and diagnose before changing code.
