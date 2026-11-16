#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Dry Run Raven — masaüstü kabuğu.
//! Mantık TypeScript tarafındadır; Rust yalnızca yerel dosya diyalogları,
//! dosya yazma ve güvenli CSP'den sorumludur. Telemetri/güncelleyici yok.

mod approved;

use std::fs;
use std::path::{Path, PathBuf};

use approved::ApprovedPaths;
use serde::Serialize;
use tauri::{AppHandle, State};
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

/// Diyalogdan dönen yolu onaylar ve ön yüze gidecek dizgesini üretir.
///
/// Onaylanan, ön yüze gönderilen dizgenin karşılığı olan yoldur; böylece
/// ön yüz aynı dizgeyi geri yolladığında birebir eşleşir.
fn approve_for_frontend(approved: &ApprovedPaths, path: &Path) -> String {
    let shown = path.to_string_lossy().to_string();
    approved.approve(Path::new(&shown));
    shown
}

#[tauri::command]
fn open_alg(
    app: AppHandle,
    approved: State<'_, ApprovedPaths>,
) -> Result<Option<OpenResult>, String> {
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
        path: approve_for_frontend(&approved, &path),
        content,
        sidecar,
    }))
}

#[tauri::command]
fn save_alg(
    app: AppHandle,
    approved: State<'_, ApprovedPaths>,
    path: Option<String>,
    default_name: String,
    content: String,
    sidecar: Option<String>,
) -> Result<Option<String>, String> {
    // Ön yüzden gelen yola yalnızca bu oturumda bir diyalogdan döndüyse
    // doğrudan yazılır. Onaylı olmayan her yol (başka bir mutlak yol, `..`
    // içeren bir yol, önceki oturumdan kalan bir yol) yok sayılır ve
    // kullanıcıya kaydetme diyaloğu açılır; nereye yazılacağına o karar verir.
    let target = match approved.resolve(path.as_deref()) {
        Some(p) => p,
        None => {
            let mut dialog = app
                .dialog()
                .file()
                .set_file_name(&default_name)
                .add_filter("Algoritma", &["alg"]);
            // İstenen yol yalnızca diyaloğun başlangıç konumu için ipucudur.
            if let Some(requested) = path.as_deref().filter(|p| !p.is_empty()).map(Path::new) {
                if let Some(name) = requested.file_name().and_then(|n| n.to_str()) {
                    dialog = dialog.set_file_name(name);
                }
                if let Some(dir) = requested.parent().filter(|d| d.is_dir()) {
                    dialog = dialog.set_directory(dir);
                }
            }
            match dialog.blocking_save_file() {
                Some(f) => ensure_ext(to_path(f)?, "alg"),
                None => return Ok(None),
            }
        }
    };
    fs::write(&target, content.as_bytes()).map_err(|e| e.to_string())?;
    if let Some(s) = sidecar {
        fs::write(sidecar_path(&target), s.as_bytes()).map_err(|e| e.to_string())?;
    }
    Ok(Some(approve_for_frontend(&approved, &target)))
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
        .manage(ApprovedPaths::default())
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
