#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Dry Run Raven — masaüstü kabuğu.
//! Mantık TypeScript tarafındadır; Rust yalnızca yerel dosya diyalogları,
//! dosya yazma ve güvenli CSP'den sorumludur. Telemetri/güncelleyici yok.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};

#[derive(Serialize)]
struct OpenResult {
    path: String,
    content: String,
    sidecar: Option<String>,
}

fn to_path(p: FilePath) -> Result<PathBuf, String> {
    p.into_path().map_err(|e| e.to_string())
}

fn ensure_ext(path: PathBuf, ext: &str) -> PathBuf {
    if path.extension().is_some() {
        path
    } else {
        path.with_extension(ext.trim_start_matches('.'))
    }
}

fn sidecar_path(path: &PathBuf) -> PathBuf {
    let mut s = path.clone().into_os_string();
    s.push(".json");
    PathBuf::from(s)
}

#[tauri::command]
fn open_alg(app: AppHandle) -> Result<Option<OpenResult>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Algoritma", &["alg", "txt"])
        .blocking_pick_file();
    let Some(file) = picked else { return Ok(None) };
    let path = to_path(file)?;
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let sidecar = fs::read_to_string(sidecar_path(&path)).ok();
    Ok(Some(OpenResult {
        path: path.to_string_lossy().to_string(),
        content,
        sidecar,
    }))
}

#[tauri::command]
fn save_alg(
    app: AppHandle,
    path: Option<String>,
    default_name: String,
    content: String,
    sidecar: Option<String>,
) -> Result<Option<String>, String> {
    let target = match path {
        Some(p) if !p.is_empty() => PathBuf::from(p),
        _ => {
            let picked = app
                .dialog()
                .file()
                .set_file_name(&default_name)
                .add_filter("Algoritma", &["alg"])
                .blocking_save_file();
            match picked {
                Some(f) => ensure_ext(to_path(f)?, "alg"),
                None => return Ok(None),
            }
        }
    };
    fs::write(&target, content.as_bytes()).map_err(|e| e.to_string())?;
    if let Some(s) = sidecar {
        fs::write(sidecar_path(&target), s.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(Some(target.to_string_lossy().to_string()))
}

#[tauri::command]
fn save_text_file(
    app: AppHandle,
    default_name: String,
    content: String,
    filter_name: String,
    ext: String,
) -> Result<Option<String>, String> {
    let clean = ext.trim_start_matches('.');
    let exts = [clean];
    let picked = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(&filter_name, &exts)
        .blocking_save_file();
    let Some(file) = picked else { return Ok(None) };
    let target = ensure_ext(to_path(file)?, clean);
    fs::write(&target, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(Some(target.to_string_lossy().to_string()))
}

#[tauri::command]
fn save_binary_file(
    app: AppHandle,
    default_name: String,
    bytes: Vec<u8>,
    filter_name: String,
    ext: String,
) -> Result<Option<String>, String> {
    let clean = ext.trim_start_matches('.');
    let exts = [clean];
    let picked = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter(&filter_name, &exts)
        .blocking_save_file();
    let Some(file) = picked else { return Ok(None) };
    let target = ensure_ext(to_path(file)?, clean);
    fs::write(&target, &bytes).map_err(|e| e.to_string())?;
    Ok(Some(target.to_string_lossy().to_string()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_alg,
            save_alg,
            save_text_file,
            save_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dry Run Raven");
}

fn main() {
    run();
}
