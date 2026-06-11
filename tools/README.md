# tools/

## `ship.ps1` — one-call release

The mechanical half of **`shipit`**. From the repo root, after you've finished the change **and
written the DEVLOG entry**:

```powershell
tools\ship.ps1 -Version 0.8.12 -Note "short changelog line"
```

It does the rest automatically: mint the next build tag (`buildCount+1` + two fresh random words),
sync the version into every build-critical file (`index.html` `APP_VERSION`/`BUILD_TAG`/`#app-title`,
`Cargo.toml`, `Cargo.lock`, `tauri.conf.json`, `build-info.json` + a history entry, and the version
line in `CONTEXT.md`/`SHORTCUTS.md`), run **both** smoke suites (hard gate — never releases red),
build + sign the installer (pre-flight gate), then commit, push `main`, and trigger `release.yml`.
CI (tauri-action) rebuilds + signs + publishes the GitHub Release + `latest.json`.

The script is **identical in both repos** and auto-derives everything repo-specific (package name from
`Cargo.toml`, GitHub repo from the `origin` remote, signing key from
`%USERPROFILE%\.tauri\<package-name>.key`). LPD's embedded `BUILD_TAG` + product-name title are updated
only where present, so the same file works for Leather Studio 3D (which has neither).

### Flags
- `-DryRun` — do every local step **including the build**, then stop before commit/push/release.
  Inspect with `git diff`; discard with `git checkout -- .`.
- `-SkipBuild` — skip `cargo tauri build` (fastest dry check; pair with `-DryRun`).

### What stays manual
Deciding the version number and **writing the DEVLOG prose entry** — judgment, not mechanics. Write
the DEVLOG entry first; the script commits it along with everything else.

### Prereqs
On branch `main`; signing key + `.password.txt` in `~/.tauri/`; `gh` authenticated. Only hard stop is a
failing smoke or build.
