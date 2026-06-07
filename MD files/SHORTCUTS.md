# Leather Studio 3D — Keyboard & Mouse Reference
_v0.0.3_

---

## Camera (3ds Max scheme)

| Input | Action |
|-------|--------|
| Middle-drag | Pan |
| Alt + Middle-drag | Orbit (arc-rotate) |
| Left-drag | Orbit (fallback for trackpads / 2-button mice) |
| Scroll / pinch | Zoom (dolly to cursor) |
| Right-drag | Pan |
| `R` | Reset camera to home view |

## File

| Input | Action |
|-------|--------|
| `Ctrl`/`Cmd` + `O` | Open a `.lpd` file |
| Drag a `.lpd` onto the canvas | Open it |
| File ▸ Load sample panel | Load the built-in demo pattern |
| File ▸ Clear scene | Remove the loaded pattern |
| File ▸ Welcome Screen | Reopen the home / welcome overlay |
| `Esc` | Dismiss the welcome screen (to an empty scene) |

## View

| Input | Action |
|-------|--------|
| View ▸ Ground grid | Toggle the grid (also in Scene panel) |
| View ▸ Wireframe | Toggle wireframe (also in Scene panel) |
| View ▸ Stitching | Toggle stitch holes + thread (also in Scene panel) |
| View ▸ Light mode | Toggle light / dark theme |

## Props panel

- **Material** — leather colour (picker + hex), roughness, thickness.
- **Stitching** — thread colour (live). Holes + thread are generated from the pattern's
  saddle-stitch data; toggle their visibility in Scene / View ▸ Stitching.
- **Lighting** — key + ambient light intensity.
- **Scene** — ground grid, wireframe.

---

_Keep this in sync when adding interactions; bump the version line with each DEVLOG entry._
