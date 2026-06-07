# Leather Studio 3D — Development Log

One entry per session, newest first. Bump `APP_VERSION` in `index.html` and the version line in
`CONTEXT.md` + `SHORTCUTS.md` with each entry.

---

## v0.0.1 — Project framework / Phase-1 skeleton (2026-06-07)

**First commit.** Stood up Leather Studio 3D as a **separate product / separate git repo** beside
the Leather Pattern Designer, per the long-planned 3D companion (see the `companion-3d-app` note).

What landed:
- **`index.html`** — single-file app shell.
  - **three.js vendored locally** (`vendor/three.module.js` + `OrbitControls.js`, pinned r0.160.0),
    wired via `<script type="importmap">` so the app runs **fully offline, no CDN**.
  - **Scene**: PerspectiveCamera + damped `OrbitControls`, ambient + key (soft-shadow) + fill
    lights, a `ShadowMaterial` ground plane, a `GridHelper`, and a `patternGroup` container.
  - **`.lpd` → 3D pipeline**: `loadPattern` → `shapeFor` → `ExtrudeGeometry`, laying each piece
    flat in the XZ plane at 1 unit = 1 mm. Handles **rect** (incl. corner radius), **circle**,
    and **path** (anchor polygon). Text + unknown types skipped. Bezier curvature not yet honoured.
  - **Material**: one shared PBR `MeshStandardMaterial` leather; live colour / roughness /
    thickness / wireframe edits re-apply across panels.
  - **UI** built to the shared **`ui-language`** tokens: dark-first + `body.light` override, one
    red accent; menubar (File / View), Figma-style props panel (Material / Stitching / Lighting /
    Scene), status bar with success **flash**.
  - **Input**: File ▸ Open, drag-and-drop `.lpd` onto the canvas, Ctrl/Cmd+O, **R** reset camera,
    plus a built-in **sample panel** so the scene is never empty.
- **Docs**: `CONTEXT.md` (architecture + the assembly-data "crux"), this `DEVLOG.md`,
  `SHORTCUTS.md`, plus root `CLAUDE.md` + `README.md`. Copied the shared **`ui-language`** skill
  into `.claude/skills/`.
- **Status line**: `.working-on.txt` = "Leather Studio 3D"; version auto-appends from
  `APP_VERSION` via the shared global status line.

**Scope note:** this is the framework only — Phases 2–4 (fold into assembled product, build
instructions, template validation) are gated on a **seam/assembly data model** that `.lpd` does
not have yet. See CONTEXT.md "The crux".

**Next:** real bezier paths in `shapeFor`; ship a sample `.lpd` in `samples/`; design the
seam/assembly metadata model (the gate for everything past viewing).
