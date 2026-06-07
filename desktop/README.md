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

## Auto-update (done)

Installed copies update themselves: **Help ▸ Check for Updates** + a silent check on launch
(`tauri-plugin-updater` / `-process`). The updater hits this repo's `latest.json`
(`releases/latest/download/latest.json`) and installs newer **signed** builds.

- **Signing key** is dedicated to this app, kept in `~/.tauri/leather-studio-3d.key` (+ `.pub` +
  `.password.txt`) — **outside the repo, never committed**. Public key is in
  `tauri.conf.json plugins.updater.pubkey`. **Do not lose it** — without it, installed apps can't
  verify future updates.
- The private key + password are GitHub repo secrets `TAURI_SIGNING_PRIVATE_KEY` /
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (set via `gh secret set`).
- **Releasing:** bump the version in `tauri.conf.json` + `Cargo.toml` + `index.html`
  (`APP_VERSION`), push, then `gh workflow run release.yml` (or push a `v*` tag).
  `.github/workflows/release.yml` builds, signs, and publishes the installer + `.sig` + `latest.json`.
- This is updater **integrity-signing** (minisign), **not** a paid Authenticode cert — SmartScreen
  still warns on first install, same as the Pattern Designer.

## Not included yet (follow-ups)

- Native Open/Save dialogs (the in-page `File ▸ Open` file input already works in WebView2).
- A paid Authenticode certificate to silence SmartScreen.

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
