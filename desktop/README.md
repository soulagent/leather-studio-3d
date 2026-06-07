# Leather Studio 3D — desktop wrapper (Tauri v2)

A thin native-`.exe` shell around the canonical single-file app. It hosts
`../index.html` (+ `../vendor/`) in a WebView2 window. **The browser app stays the
source of truth and fallback** — `build.rs` only ever *reads* the root files and
copies them into `dist/` at build time, so a broken desktop build can never corrupt
the standalone HTML app.

## What it adds over the browser

- A native window + taskbar entry / Start-menu install (NSIS installer).
- **Single instance** + **"Open with → Leather Studio 3D"** on a `.lpd`: the file is
  read by the Rust side and loaded straight into the viewer (`take_launch_file` /
  the `open-lpd` event).

It deliberately does **not** register itself as the default `.lpd` handler — the
Leather Pattern Designer owns that association (it's the editor); this is a viewer
you reach via "Open with" or File ▸ Open.

## Not included yet (follow-ups)

- **Auto-update** (updater/process plugins). That needs its own signing key, a
  GitHub repo, secrets, and a release pipeline — see the Pattern Designer's
  auto-update setup to replicate when wanted.
- Native Open/Save dialogs (the in-page `File ▸ Open` file input already works in
  WebView2, so they're optional).

## Prerequisites

- **Rust** (stable) + the Tauri CLI (`cargo install tauri-cli` or `cargo-tauri`).
- **WebView2 runtime** (present on current Windows 10/11).
- No Node — the app is one static file.

## Build

```powershell
# from desktop/src-tauri
cargo tauri build
```

`build.rs` first syncs `../../index.html` and `../../vendor/*` into `../dist/`, then
Tauri bundles an NSIS installer under
`src-tauri/target/release/bundle/nsis/`. Keep `version` in `tauri.conf.json` +
`Cargo.toml` in sync with `APP_VERSION` in `index.html`.

A fast static check of the build wiring (no compile) lives at
`../tests/run-build-smoke.ps1`.
