use std::{fs, path::Path};

fn main() {
    // Keep the desktop frontend in sync with the canonical single-file app.
    // Cargo runs build.rs with CWD = this crate dir (desktop/src-tauri), so the
    // paths below are deterministic regardless of where the build was invoked.
    //
    //   ../../index.html  = repo-root index.html  (the source of truth + fallback)
    //   ../../vendor/     = vendored three.js (classic scripts; index.html needs them)
    //   ../dist           = desktop/dist          (what Tauri bundles)
    //
    // The root files are only ever READ here, never written, so a broken desktop
    // build can never corrupt the standalone HTML app.
    let dist = Path::new("../dist");
    let _ = fs::create_dir_all(dist);

    if let Err(e) = fs::copy("../../index.html", dist.join("index.html")) {
        println!("cargo:warning=could not sync index.html into dist: {e}");
    }

    // Copy the whole vendor/ folder (three.min.js + OrbitControls.classic.js).
    // Without this the bundled app can't load three.js and shows a blank canvas.
    let vsrc = Path::new("../../vendor");
    let vdst = dist.join("vendor");
    let _ = fs::create_dir_all(&vdst);
    if let Ok(entries) = fs::read_dir(vsrc) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_file() {
                if let Some(name) = p.file_name() {
                    if let Err(e) = fs::copy(&p, vdst.join(name)) {
                        println!("cargo:warning=could not sync vendor file {name:?}: {e}");
                    }
                }
            }
        }
    } else {
        println!("cargo:warning=vendor/ not found; the bundled app will be missing three.js");
    }

    // Re-run this script (and re-copy) whenever the root app or its vendor files change.
    println!("cargo:rerun-if-changed=../../index.html");
    println!("cargo:rerun-if-changed=../../vendor");

    tauri_build::build();
}
