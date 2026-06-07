// Prevents an extra console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Emitter, Manager};

// Holds the absolute path of a .lpd passed on the command line ("Open with ...
// Leather Studio 3D"). Read once by the frontend on startup via `take_launch_file`,
// which hands back the file's contents so the viewer can load it immediately.
struct LaunchFile(Mutex<Option<String>>);

// Return (and clear) the launch document as [path, contents], if the app was opened
// with a .lpd that still reads. None -> normal launch (the empty scene is shown).
#[tauri::command]
fn take_launch_file(state: tauri::State<LaunchFile>) -> Option<(String, String)> {
    let path = state.0.lock().unwrap().take()?;
    let contents = std::fs::read_to_string(&path).ok()?;
    Some((path, contents))
}

// First CLI argument that looks like a .lpd file. "Open with" launches the exe as
// `"...exe" "%1"`, so the path arrives as argv[1].
fn launch_path() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| a.to_lowercase().ends_with(".lpd"))
}

fn main() {
    tauri::Builder::default()
        // Single-instance must be registered first. When a 2nd launch happens (e.g.
        // "Open with" on another .lpd), this runs in the ALREADY-running app: focus our
        // window and, if a .lpd was passed, read it and emit `open-lpd` so the frontend
        // loads it into the existing window instead of opening a 2nd window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
                if let Some(path) = argv.iter().find(|a| a.to_lowercase().ends_with(".lpd")) {
                    if let Ok(content) = std::fs::read_to_string(path) {
                        let _ = win.emit("open-lpd", (path.clone(), content));
                    }
                }
            }
        }))
        .manage(LaunchFile(Mutex::new(launch_path())))
        .invoke_handler(tauri::generate_handler![take_launch_file])
        .run(tauri::generate_context!())
        .expect("error while running Leather Studio 3D");
}
