---
description: Quick smoke test for Leather Studio 3D (kernel + outline)
---
Run the **quick-tier** smoke test for Leather Studio 3D.

Execute this with the PowerShell tool from the project root:

```
& "tests\run-smoke.ps1" -Tier quick
```

This injects `tests/smoke-harness.js` into a copy of `index.html`, runs it in
headless Edge (software GL via SwiftShader), and reports PASS/FAIL for the
geometry kernel (cubic bezier sampling, rectRounded) and `outlinePolygon`
(sharp/rounded rect, circle, and the PEN-path regression).

After it runs, summarize the results. If any assertion FAILS, open `index.html`,
locate the function behind the failing assertion, and diagnose before changing code.
