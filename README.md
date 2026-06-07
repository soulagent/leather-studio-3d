# Leather Studio 3D

A companion to the **Leather Pattern Designer**: load a finished pattern (`.lpd`) and preview the
pieces in **3D** — leather material, stitch colour, full camera control, and lighting.

The whole app is a single `index.html` with **no build step and no CDN** (three.js is vendored in
`vendor/`), so it runs fully offline. Just open `index.html` in any modern browser.

---

## ▶️ Run it

1. Open `index.html` in a modern browser (Chrome/Edge/Firefox).
2. **File ▸ Open .lpd** (or drag a `.lpd` onto the canvas), or **File ▸ Load sample panel**.
3. Drag to orbit · scroll to zoom · right-drag to pan. Press **R** to reset the camera.

---

## ✨ What it does (Phase 1 — viewer MVP)

- Renders each pattern piece as a **flat leather panel** in 3D at true mm scale.
- **Material controls** — leather colour, roughness, thickness; stitch thread colour.
- **Lighting** — key + ambient light intensity, soft shadows on a ground plane.
- **Scene** — ground grid, wireframe toggle, light/dark themes (shared with the Pattern Designer).

## 🗺️ Where it's going

Folding flat pieces into the **assembled** product, **build instructions**, and **template
validation** are the next phases — but they need **assembly/seam metadata that `.lpd` doesn't
carry yet**. See [`MD files/CONTEXT.md`](MD%20files/CONTEXT.md) for the full phased plan and the
data-gap "crux", and [`MD files/DEVLOG.md`](MD%20files/DEVLOG.md) for the changelog.

---

## 🧩 Relationship to the Pattern Designer

This is a **separate product / separate repo**. It only *reads* `.lpd` files; it never writes
them. The two apps share one visual + interaction design language (the `ui-language` skill in
`.claude/skills/`) so they feel like one family.

## 🛠️ Updating three.js

three.js is vendored at a pinned version in `vendor/` (`three.module.js` + `OrbitControls.js`).
To upgrade, re-download both files from the same release into `vendor/` — nothing else to do.
