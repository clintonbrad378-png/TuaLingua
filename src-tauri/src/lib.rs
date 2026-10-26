mod catalog;
mod dictionary;
mod progress;

use progress::{Db, PhraseDto, RoundResult, SessionSummary, SrsCardDto};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use tauri::{Manager, State};

pub struct AppState {
    pub db: Mutex<Db>,
    pub path: PathBuf,
}

type Res<T> = Result<T, String>;

/// Bloquea la base de datos sin propagar panics: si el Mutex está envenenado
/// (un panic anterior con el lock tomado), las llamadas fallan con error en
/// lugar de tumbar la app entera.
fn lock_db<'a>(state: &'a State<'_, AppState>) -> Res<MutexGuard<'a, Db>> {
    state
        .db
        .lock()
        .map_err(|e| format!("error interno de base de datos: {e}"))
}

fn lock_and_save<T, F>(state: &State<'_, AppState>, f: F) -> Res<T>
where
    F: FnOnce(&mut Db) -> T,
{
    let mut db = lock_db(state)?;
    let out = f(&mut db);
    db.save(&state.path)?;
    Ok(out)
}

fn to_json<T: Serialize>(v: T) -> Res<Value> {
    serde_json::to_value(v).map_err(|e| format!("error interno al serializar: {e}"))
}

#[tauri::command]
fn get_languages() -> Vec<catalog::LanguageInfo> {
    catalog::languages().to_vec()
}

#[tauri::command]
fn get_catalog(state: State<'_, AppState>) -> Res<Value> {
    let lang = {
        let db = lock_db(&state)?;
        db.lang().to_string()
    };
    Ok(catalog::catalog_json(&lang).clone())
}

#[tauri::command]
fn get_dictionary(state: State<'_, AppState>) -> Res<Value> {
    let lang = {
        let db = lock_db(&state)?;
        db.lang().to_string()
    };
    Ok(dictionary::dictionary_json(&lang).clone())
}

#[tauri::command]
fn set_language(lang: String, state: State<'_, AppState>) -> Res<Value> {
    let mut db = lock_db(&state)?;
    if !db.set_language(&lang) {
        return Err(format!("idioma desconocido: {lang}"));
    }
    let snapshot = to_json(db.snapshot_ref())?;
    db.save(&state.path)?;
    Ok(snapshot)
}

#[tauri::command]
fn get_deck(state: State<'_, AppState>) -> Res<Vec<PhraseDto>> {
    Ok(lock_db(&state)?.deck_cards())
}

#[tauri::command]
fn toggle_deck_card(es: String, t: String, state: State<'_, AppState>) -> Res<Vec<PhraseDto>> {
    lock_and_save(&state, |db| {
        db.toggle_deck(&es, &t);
        db.deck_cards()
    })
}

#[tauri::command]
fn clear_deck(state: State<'_, AppState>) -> Res<Vec<PhraseDto>> {
    lock_and_save(&state, |db| {
        db.clear_deck();
        db.deck_cards()
    })
}

#[tauri::command]
fn get_progress(state: State<'_, AppState>) -> Res<Value> {
    let db = lock_db(&state)?;
    to_json(db.snapshot_ref())
}

#[tauri::command]
fn complete_lesson(
    state: State<'_, AppState>,
    lesson_id: String,
    correct: u32,
    total: u32,
    combo_max: u32,
    rounds: Vec<RoundResult>,
) -> Res<SessionSummary> {
    let mut db = lock_db(&state)?;
    let mut summary = db.session(Some(&lesson_id), correct, total, combo_max, &rounds);
    summary.save_ok = db.save(&state.path).is_ok();
    Ok(summary)
}

#[tauri::command]
fn submit_review(
    state: State<'_, AppState>,
    correct: u32,
    total: u32,
    combo_max: u32,
    rounds: Vec<RoundResult>,
) -> Res<SessionSummary> {
    let mut db = lock_db(&state)?;
    let mut summary = db.session(None, correct, total, combo_max, &rounds);
    summary.save_ok = db.save(&state.path).is_ok();
    Ok(summary)
}

#[tauri::command]
fn get_review(state: State<'_, AppState>, limit: u32) -> Res<Vec<SrsCardDto>> {
    Ok(lock_db(&state)?.due_cards(limit as usize))
}

#[tauri::command]
fn set_daily_goal(goal: u32, state: State<'_, AppState>) -> Res<Value> {
    let mut db = lock_db(&state)?;
    db.set_daily_goal(goal);
    let snapshot = to_json(db.snapshot_ref())?;
    db.save(&state.path)?;
    Ok(snapshot)
}

#[tauri::command]
fn reset_progress(state: State<'_, AppState>) -> Res<Value> {
    let mut db = lock_db(&state)?;
    *db = Db::default();
    db.lang = catalog::EN.to_string();
    let snapshot = to_json(db.snapshot_ref())?;
    db.save(&state.path)?;
    Ok(snapshot)
}

#[tauri::command]
fn export_progress(state: State<'_, AppState>) -> Res<String> {
    let db = lock_db(&state)?;
    db.export_json()
}

#[tauri::command]
fn save_export(path: String, json: String) -> Res<()> {
    if path.trim().is_empty() {
        return Err("ruta vacía".to_string());
    }
    if json.trim().is_empty() {
        return Err("export vacío".to_string());
    }
    Db::export_to_path(std::path::Path::new(&path), &json)
}

#[tauri::command]
fn import_progress(path: String, state: State<'_, AppState>) -> Res<Value> {
    if path.trim().is_empty() {
        return Err("ruta vacía".to_string());
    }
    let raw =
        std::fs::read_to_string(&path).map_err(|e| format!("no se pudo leer {path}: {e}"))?;
    let imported = Db::import_from_str(&raw)?;
    let mut db = lock_db(&state)?;
    *db = imported;
    let snapshot = to_json(db.snapshot_ref())?;
    db.save(&state.path)?;
    Ok(snapshot)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            get_languages,
            get_catalog,
            get_dictionary,
            set_language,
            get_deck,
            toggle_deck_card,
            clear_deck,
            get_progress,
            complete_lesson,
            submit_review,
            get_review,
            set_daily_goal,
            export_progress,
            save_export,
            import_progress,
            reset_progress
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
