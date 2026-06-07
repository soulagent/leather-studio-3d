---
name: leather-ui-language
description: >-
  The shared visual + interaction design language for the Leather Pattern
  Designer and its planned 3D companion app. Defines the colour palette (dark
  default + light override, shared red accent), spacing/typography scale, the
  Figma-style property-panel rows (.p-grp / .p-pair / .p-field), themed in-app
  dialogs (confirmModal / alertModal — never native confirm/alert), the
  decorative french-stitch border (frenchBorder), toolbar + menubar grouping,
  layers rows, the status-bar "flash" feedback pattern, and the mm-true SVG
  rendering rules. Use this whenever you add or restyle UI in either app — a new
  panel, button, dialog, form row, menu, toolbar item, or status message — or
  when starting the companion tool's UI, so both products look and behave like
  one family. These are stack-independent design tokens + interaction rules: they
  apply whether the UI is built in HTML/CSS today or C++ later. Do NOT use this
  for the stitch-hole GEOMETRY algorithm (that's stitch-edge-logic) or for
  non-UI logic.
---

# Leather Pattern Designer — UI Language

One visual + interaction language shared by the pattern designer (`index.html`)
and the planned 3D companion app. Treat these as **design tokens + rules**, not
copy-paste CSS — they hold across stacks (HTML/CSS now, C++ later). Values below
are the live ones in `index.html`; keep this file and the app in sync when either
changes.

## 1. Principles

- **Dark-first, light as an additive override.** The dark theme is the default
  and the source of truth; light mode is a `body.light` override block that only
  recolours — never restructures. Never fork layout per theme.
- **One shared red accent across both themes.** Selection, active tool, focus
  ring, primary buttons, checkmarks, checkboxes — all the same red in light and
  dark. It is the single "this is the brand / this is active" signal.
- **Quiet chrome, loud accent.** Chrome (panels, menus, toolbar) is low-contrast
  near-navy greys; the only saturated colour is the accent and the per-shape
  palette on the canvas. Don't introduce new accent colours for UI states.
- **Themed in-app dialogs, never native.** `confirm()`/`alert()`/`prompt()` are
  banned — they break the theme and the french-stitch identity. Use the modal
  helpers (§6).
- **Tight, dense, Figma/Illustrator-like.** Small type (9–13px), 4–11px paddings,
  grouped two-column property rows. This is a pro CAD tool, not a marketing page.
- **mm is truth on the canvas.** Geometry is millimetres; print/export are 1:1
  physical scale. UI px and world mm never get conflated (§8).

## 2. Colour tokens

**These are real CSS custom properties** (since v0.7.19): `:root` holds the dark defaults, `body.light`
re-points them. Use `var(--token)` in new rules and **edit the value at the token, never at the call
site**. Text tiers: `--text` (primary), `--text-2` (secondary), `--text-muted`, `--text-faint`,
`--text-heading`. Surfaces: `--bg --canvas --panel --raised --dialog --hover --border --border-soft`.
Accent: `--accent` (fills w/ white text), `--accent-bright` (borders/strokes/focus), `--accent-hover`
(hover fills), `--accent-soft`. Semantic/canvas: `--success --drop --shape --stitch`. Every text tier
meets WCAG AA on its worst-case surface in both themes — don't introduce a raw grey hex for text.

### Dark (default)
| Role | Value |
|---|---|
| App background / canvas void | `#1a1a2e` body, `#0d0d1f` canvas + deepest strips |
| Chrome panel bg (menubar/toolbar/props/status) | `#12122a` |
| Raised surface (dropdowns, inputs, modal) | `#1e1e38` |
| Modal/dialog bg | `#16162c` (confirm), `#1e1e38` (settings modal) |
| Hover surface | `#2a2a4a` |
| Borders / separators | `#2a2a4a` (lines `#242444` / `#1e1e38` for subtle) |
| Primary text | `#eee` |
| Secondary / label text | `#888` · muted `#777` / `#555` |
| Group-heading text | `#6c6c92` |
| **Accent (shared)** | base `#c0392b`, bright `#e74c3c` |
| Accent — unsaved-dot / soft | `#e0506a` |
| Status "saved ✓" green | `#4a8` |
| Drop-indicator cyan | `#4dd2ff` |

### Light (`body.light` override)
| Role | Value |
|---|---|
| App background | `#eef0f4` · canvas `#fbfbfd` |
| Chrome panel bg | `#e4e6ee` |
| Raised surface / inputs | `#fff` |
| Hover surface | `#d4d7e4` / `#e6e8f2` |
| Borders | `#cdd0dc` / `#dde0ea` |
| Primary text | `#23232e` · secondary `#888` |
| **Accent (shared, unchanged)** | `#c0392b` / `#e74c3c` |

**Rule:** when adding a UI element, define its dark colours first, then add the
matching `body.light` override in the LIGHT MODE block. Never leave a new element
un-themed (it will look broken in light mode).

### Canvas / SVG semantic colours (both themes)
| Thing | Value |
|---|---|
| Shape stroke (default) | `#3a7bd5` (blue), fill `rgba(255,255,255,.04)` |
| Shape selected | stroke `#e74c3c`, fill `rgba(231,76,60,.07)` |
| Stitch line / holes | `#e67e22` (orange) |
| Forced-corner hole highlight | `#00e0c6` (cyan) |
| Pen first-anchor (close cue) | `#27ae60` (green) |
| Per-shape palette | `SHAPE_COLORS` — blue, red, green, orange, purple, teal, yellow, pink, dark-orange, grey |

## 3. Typography & spacing scale

- Font: `system-ui, sans-serif` everywhere (UI and on-canvas labels).
- Sizes: **9px** group/section micro-headings (uppercase, letter-spacing ~.07em,
  `text-transform:uppercase`) · **10–11px** labels/notes · **12px** inputs &
  menu actions · **13px** menu items / dialog body · **15px** dialog/modal `h3`.
- Section & group headings are uppercase with letter-spacing; body text is not.
- Spacing: panel padding `0 11px`, rows `margin-bottom:5px`, group heading
  `margin:17px 0 8px`. Radii: 4px inputs/buttons, 6px tool buttons/tabs, 8–10px
  modals. Keep to this scale; don't invent new paddings.

## 4. Layout shell

`menubar (30px) → tabbar (30px) → main[ toolbar(46px) | canvas(flex) | props-resize(6px) | props(210px, resizable) ] → status(22px)`.
- Toolbar is icon-only 34×34 buttons, vertical, with `.t-sep` group dividers and
  a CSS `data-tip` tooltip on the right.
- Props panel is collapsible sections (`.p-sec` / `.p-hd` / `.p-sec-body`),
  width persisted to `localStorage['lpat-props-w']`.

## 5. Component patterns

### Tool / toggle button states
- Default: transparent bg, `#aaa` icon, transparent border.
- Hover: `#2a2a4a` bg, white icon.
- **Active/on: `#c0392b` bg, `#e74c3c` border, white icon.** (Same recipe for
  `.t-btn.active`, `.p-btn.on`, `.lay`/align cells — active == accent fill.)

### Property rows (Figma-style — use these, don't hand-roll forms)
- `.p-grp` — uppercase subcategory heading with bottom border (e.g. Position,
  Size, Rotation, Appearance).
- `.p-pair` — 2-col grid for paired fields (X|Y, W|H).
- `.p-field` — one labelled field; `.p-fl` is the tiny single-char label (13px
  wide, e.g. "X"), `.p-lbl` the wider 52px label.
- `.p-inp` / `.p-sel` — inputs; **focus = accent border** (`border-color:#e74c3c`,
  no outline). `[readonly]` dims the text.
- `.p-ck-row` — checkbox row; checkbox `accent-color:#e74c3c`.
- Pattern: group heading → paired rows → checkboxes → optional `.p-note` (10px
  muted helper text).

### Inputs & focus
- Every focusable input loses the browser outline and gains an **accent border**
  on focus. Keep this consistent — it's the focus language.

### Menus
- Menubar `.m-item` → hover/`focus-within` opens `.m-drop`. Actions `.m-act` show
  text left, keyboard hint (`.kb`, `#555`) and checkmark (`.m-chk`, accent)
  right-aligned. `.m-sep` dividers, `.m-grp-lbl` uppercase group labels, `.m-nest`
  for submenus. Checkmark glyph toggled via `setMenuCheck(id,on)`.

### Layers rows
- `.lay-row` (grip ⠿ · colour swatch · name · ▲▼ · eye/lock toggles), selected =
  `#23234a` bg + accent-ish border; drag drop indicators use the cyan
  `box-shadow:inset 0 ±2px #4dd2ff`. Hidden rows dim to `opacity:.4`; lock toggle
  goes orange (`#e07a3c`).

## 6. Dialogs & feedback (interaction rules)

- **`confirmModal(message, opts)` → `Promise<bool>`.** `opts = {ok, cancel,
  danger, title}`. `cancel:null` turns it into an alert. `danger:true` styles the
  primary button as destructive (still accent-red here). Always `await` it.
- **`alertModal(message, title)`** = `confirmModal` with no cancel. Use for
  errors ("Could not save file: …", "Open Failed").
- Both are framed by the **french-stitch border** and theme-aware. Esc / backdrop
  cancels; the OK button auto-focuses.
- **Never** call native `confirm`/`alert`/`prompt`. For new flows, reach for these
  two helpers.
- **Status flash** = the lightweight "it worked" signal. `flashSaved(msg)` shows a
  message in the status bar for ~2.5s (default "Saved ✓", green `#4a8`), then
  reverts. Use it for non-blocking confirmations (saved, exported N files) instead
  of a dialog. Reserve modals for decisions and errors.

## 7. The french-stitch motif (brand identity)

`frenchBorder(w, h, {inset, sp, L, Wd})` returns an SVG `<g>` of slanted slit
"stitches" running the rectangle perimeter — each a rounded-rect rotated
`angle − 30°` (the Vergez-Blanchard slant). It frames the welcome screen
(`renderHomeStitch`) and every themed dialog (`sizeConfirmBorder`). This is the
product's signature decoration — **reuse it for new framed surfaces** (e.g. the
companion app's welcome / about / export-complete cards) rather than inventing a
new border. Tune density via `sp` (spacing) and slit size via `L`×`Wd`.

## 8. Canvas / rendering rules (carry into the 3D app's 2D overlays)

- All geometry is **mm**; the viewport group carries
  `translate(panX panY) scale(zoom * PX_PER_MM)`, `PX_PER_MM = 3.7795275591`.
- For a **fixed N-pixel** visual size inside the viewport, use `N / (S.zoom*PX)`
  mm (handles, labels, hit zones). Don't hardcode mm for screen-constant UI.
- Stroke units depend on `vector-effect`: with `non-scaling-stroke`, width is
  screen px; without, it's mm (scales with zoom). Use plain mm widths for shape
  outlines; reserve `non-scaling-stroke` for pixel-exact aids (grid). Mixing them
  silently yields ~0.1px invisible strokes.
- Print/export are always **true physical scale** and always black on white
  (print ignores theme).

## 9. Checklist when adding UI

1. Use existing tokens (§2) and the spacing scale (§3) — no new greys/paddings.
2. Reuse a component pattern (§5): property rows, tool-button states, menu rows.
3. Active/selected state == accent fill; focus == accent border.
4. Add the **`body.light` override** for every new element in the same commit.
5. Decisions/errors → `confirmModal`/`alertModal`; success → `flashSaved` (§6).
6. Framed/welcome surface → reuse `frenchBorder` (§7).
7. Screen-constant sizing on the canvas → `N/(S.zoom*PX)` mm (§8).
8. Print stays black-on-white, theme-independent.
