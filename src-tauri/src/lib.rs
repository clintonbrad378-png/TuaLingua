mod catalog;
mod progress;

use catalog::Unit;
use progress::{Db, ProgressState, RoundResult, SessionSummary, SrsCardDto};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Manager, State};

pub struct AppState {
    pub db: Mutex<Db>,
    pub path: PathBuf,
}

#[tauri::command]
fn get_catalog() -> Vec<Unit> {
    catalog::catalog().clone()
}

#[tauri::command]
fn get_progress(state: State<'_, AppState>) -> ProgressState {
    state.db.lock().unwrap().snapshot()
}

#[tauri::command]
fn complete_lesson(
    state: State<'_, AppState>,
    lesson_id: String,
    correct: u32,
    total: u32,
    combo_max: u32,
    rounds: Vec<RoundResult>,
) -> SessionSummary {
    let mut db = state.db.lock().unwrap();
    let summary = db.session(Some(&lesson_id), correct, total, combo_max, &rounds);
    db.save(&state.path);
    summary
}

#[tauri::command]
fn submit_review(
    state: State<'_, AppState>,
    correct: u32,
    total: u32,
    combo_max: u32,
    rounds: Vec<RoundResult>,
) -> SessionSummary {
    let mut db = state.db.lock().unwrap();
    let summary = db.session(None, correct, total, combo_max, &rounds);
    db.save(&state.path);
    summary
}

#[tauri::command]
fn get_review(state: State<'_, AppState>, limit: u32) -> Vec<SrsCardDto> {
    state.db.lock().unwrap().due_cards(limit as usize)
}

#[tauri::command]
fn reset_progress(state: State<'_, AppState>) -> ProgressState {
    let mut db = state.db.lock().unwrap();
    *db = Db::default();
    db.save(&state.path);
    db.snapshot()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            let path = dir.join("progress.json");
            let db = Db::load(&path);
            app.manage(AppState {
                db: Mutex::new(db),
                path,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_progress,
            complete_lesson,
            submit_review,
            get_review,
            reset_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
