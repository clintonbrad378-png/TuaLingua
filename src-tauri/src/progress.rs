use chrono::{Duration, Local, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::io::Write;
use std::path::{Path, PathBuf};

pub const DEFAULT_DAILY_GOAL: u32 = 60;
pub const MIN_DAILY_GOAL: u32 = 10;
pub const MAX_DAILY_GOAL: u32 = 300;
/// Ventana de historial (días) que se expone para el calendario de rachas.
pub const HISTORY_DAYS: u64 = 91;
/// Versión del esquema de progress.json / exports. Los archivos sin `version`
/// se tratan como v1 (campos `en` en vez de `t`).
pub const SCHEMA_VERSION: u32 = 2;
pub const SAVE_BACKUPS: usize = 3;

const TITLES: [&str; 7] = [
    "Novato",
    "Curioso",
    "Charlatán",
    "Viajero",
    "Conversador",
    "Casi bilingüe",
    "Maestro del idioma",
];

fn default_lang() -> String {
    "en".to_string()
}

fn default_version() -> u32 {
    1
}

fn default_goal() -> u32 {
    DEFAULT_DAILY_GOAL
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct LessonProgress {
    pub best_accuracy: u32,
    pub stars: u32,
    pub times: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct SrsCard {
    pub es: String,
    #[serde(alias = "en")]
    pub t: String,
    #[serde(default)]
    pub lang: String,
    pub ease: f32,
    pub interval: u32,
    pub reps: u32,
    pub lapses: u32,
    pub due: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct DayXp {
    pub day: String,
    pub xp: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Db {
    pub xp: u32,
    pub xp_today: u32,
    pub xp_day: Option<String>,
    pub streak: u32,
    pub best_streak: u32,
    pub last_active: Option<String>,
    pub lessons: HashMap<String, LessonProgress>,
    pub srs: HashMap<String, SrsCard>,
    pub total_correct: u32,
    pub total_answers: u32,
    #[serde(default)]
    pub deck: Vec<PhraseDto>,
    #[serde(default = "default_lang")]
    pub lang: String,
    /// XP ganado por día (calendario de rachas).
    #[serde(default)]
    pub history: BTreeMap<String, u32>,
    /// Meta diaria configurable por la usuaria.
    #[serde(default = "default_goal")]
    pub daily_goal: u32,
    #[serde(default = "default_version")]
    pub version: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RoundResult {
    pub es: String,
    #[serde(alias = "en")]
    pub t: String,
    pub correct: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SrsCardDto {
    pub es: String,
    #[serde(alias = "en")]
    pub t: String,
    pub due: String,
    pub reps: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ProgressState {
    pub xp: u32,
    pub level: u32,
    pub level_title: String,
    pub level_xp: u32,
    pub level_needed: u32,
    pub streak: u32,
    pub best_streak: u32,
    pub active_today: bool,
    pub xp_today: u32,
    pub daily_goal: u32,
    pub total_correct: u32,
    pub total_answers: u32,
    pub words_learned: u32,
    pub due_count: u32,
    pub srs_count: u32,
    pub lessons: HashMap<String, LessonProgress>,
    pub deck_count: u32,
    pub lang: String,
    pub history: Vec<DayXp>,
}

/// Igual que [`ProgressState`] pero con referencias, para serializar el
/// snapshot sin clonar el mapa de lecciones (la ruta caliente de IPC).
#[derive(Serialize)]
pub struct SnapshotRef<'a> {
    pub xp: u32,
    pub level: u32,
    pub level_title: &'a str,
    pub level_xp: u32,
    pub level_needed: u32,
    pub streak: u32,
    pub best_streak: u32,
    pub active_today: bool,
    pub xp_today: u32,
    pub daily_goal: u32,
    pub total_correct: u32,
    pub total_answers: u32,
    pub words_learned: u32,
    pub due_count: u32,
    pub srs_count: u32,
    pub lessons: &'a HashMap<String, LessonProgress>,
    pub deck_count: u32,
    pub lang: &'a str,
    pub history: Vec<DayXp>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SessionSummary {
    pub xp_gained: u32,
    pub total_xp: u32,
    pub streak: u32,
    pub streak_up: bool,
    pub best_streak: u32,
    pub level: u32,
    pub level_title: String,
    pub level_up: bool,
    pub level_xp: u32,
    pub level_needed: u32,
    pub accuracy: u32,
    pub correct: u32,
    pub total: u32,
    pub combo_max: u32,
    pub stars: u32,
    pub new_words: Vec<PhraseDto>,
    pub due_count: u32,
    pub words_learned: u32,
    /// `false` si el progreso se aplicó en memoria pero no se pudo persistir.
    pub save_ok: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PhraseDto {
    pub es: String,
    #[serde(alias = "en")]
    pub t: String,
    #[serde(default = "default_lang")]
    pub lang: String,
}

impl PhraseDto {
    pub fn new(lang: &str, es: &str, t: &str) -> Self {
        Self {
            es: es.trim().to_string(),
            t: t.trim().to_string(),
            lang: lang.to_string(),
        }
    }
}

fn today() -> NaiveDate {
    Local::now().date_naive()
}

fn card_key(lang: &str, es: &str, t: &str) -> String {
    format!(
        "{}|{}|{}",
        lang.trim().to_lowercase(),
        es.trim().to_lowercase(),
        t.trim().to_lowercase()
    )
}

fn level_needed(level: u32) -> u32 {
    (level - 1)
        .saturating_mul(150)
        .min(1100)
        .saturating_add(400)
}

fn level_parts(xp: u32) -> (u32, &'static str, u32) {
    let mut level: u32 = 1;
    let mut rest = xp;
    while rest >= level_needed(level) {
        rest -= level_needed(level);
        level += 1;
    }
    let idx = (level as usize - 1).min(TITLES.len() - 1);
    (level, TITLES[idx], rest)
}

fn stars_for(accuracy: u32) -> u32 {
    if accuracy >= 90 {
        3
    } else if accuracy >= 70 {
        2
    } else {
        1
    }
}

fn clamp_goal(goal: u32) -> u32 {
    goal.clamp(MIN_DAILY_GOAL, MAX_DAILY_GOAL)
}

fn backup_path(path: &Path, n: usize) -> PathBuf {
    PathBuf::from(format!("{}.bak{n}", path.display()))
}

/// Rota progress.json → .bak1 → .bak2 → .bak3 (descarta el más viejo).
fn rotate_backups(path: &Path) {
    let mut next = if path.exists() { Some(path.to_path_buf()) } else { None };
    for n in 1..=SAVE_BACKUPS {
        let Some(src) = next.take() else { break };
        let b = backup_path(path, n);
        if n < SAVE_BACKUPS {
            // El siguiente destino es la copia anterior del siguiente turno.
            next = Some(b.clone());
        } else if b.exists() {
            let _ = std::fs::remove_file(&b);
        }
        let _ = std::fs::copy(&src, &b);
    }
}

impl Default for Db {
    fn default() -> Self {
        Self {
            xp: 0,
            xp_today: 0,
            xp_day: None,
            streak: 0,
            best_streak: 0,
            last_active: None,
            lessons: HashMap::new(),
            srs: HashMap::new(),
            total_correct: 0,
            total_answers: 0,
            deck: Vec::new(),
            lang: "en".to_string(),
            history: BTreeMap::new(),
            daily_goal: DEFAULT_DAILY_GOAL,
            version: SCHEMA_VERSION,
        }
    }
}

impl Db {
    fn sanitize(mut db: Db) -> Self {        db.lang = crate::catalog::normalize_lang(&db.lang).to_string();
        let mut migrated: HashMap<String, SrsCard> =
            HashMap::with_capacity(db.srs.len());
        for (_, mut card) in db.srs.drain() {
            if card.lang.is_empty() {
                card.lang = "en".to_string();
            }
            migrated.insert(card_key(&card.lang, &card.es, &card.t), card);
        }
        db.srs = migrated;
        db.daily_goal = clamp_goal(db.daily_goal);
        db.version = db.version.clamp(1, SCHEMA_VERSION);
        db
    }

    pub fn load(path: &Path) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .map(Self::sanitize)
            .map(|mut db| {
                db.version = SCHEMA_VERSION;
                db
            })
            .unwrap_or_default()
    }

    pub fn load_from_str(raw: &str) -> Self {
        serde_json::from_str(raw)
            .map(Self::sanitize)
            .unwrap_or_default()
    }

    /// Import estricto: falla con un mensaje legible en vez de
    /// descartar silenciosamente el progreso del archivo.
    pub fn import_from_str(raw: &str) -> Result<Self, String> {
        let parsed: Db = serde_json::from_str(raw)
            .map_err(|e| format!("archivo de progreso no válido: {e}"))?;
        if parsed.version > SCHEMA_VERSION {
            return Err(format!(
                "el archivo usa una versión más nueva ({}) que esta app ({})",
                parsed.version, SCHEMA_VERSION
            ));
        }
        let mut db = Self::sanitize(parsed);
        db.version = SCHEMA_VERSION;
        Ok(db)
    }

    pub fn export_json(&self) -> Result<String, String> {
        let mut copy = self.clone();
        copy.version = SCHEMA_VERSION;
        serde_json::to_string_pretty(&copy)
            .map(|s| format!("{s}\n"))
            .map_err(|e| format!("no se pudo exportar el progreso: {e}"))
    }

    pub fn export_to_path(target: &Path, raw: &str) -> Result<(), String> {
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("no se pudo crear la carpeta destino: {e}"))?;
        }
        std::fs::write(target, raw)
            .map_err(|e| format!("no se pudo escribir {target:?}: {e}"))
    }

    /// Guarda atómicamente (tmp + rename) con fsync y mantiene `SAVE_BACKUPS`
    /// copias rotativas de la versión anterior.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("no se pudo crear la carpeta de datos: {e}"))?;
        }
        let raw = serde_json::to_vec(self)
            .map_err(|e| format!("no se pudo serializar el progreso: {e}"))?;
        let tmp = path.with_extension("json.tmp");
        {
            let mut file = std::fs::File::create(&tmp)
                .map_err(|e| format!("no se pudo abrir el archivo temporal: {e}"))?;
            file.write_all(&raw)
                .and_then(|_| file.sync_all())
                .map_err(|e| format!("no se pudo escribir el progreso: {e}"))?;
        }
        rotate_backups(path);
        std::fs::rename(&tmp, path)
            .map_err(|e| format!("no se pudo guardar el progreso: {e}"))?;
        #[cfg(unix)]
        if let Ok(dir) = std::fs::File::open(
            path.parent().unwrap_or_else(|| Path::new(".")),
        ) {
            let _ = dir.sync_all();
        }
        Ok(())
    }

    pub fn lang(&self) -> &str {
        &self.lang
    }

    pub fn set_language(&mut self, lang: &str) -> bool {
        let norm = crate::catalog::normalize_lang(lang);
        if norm != lang {
            return false;
        }
        self.lang = norm.to_string();
        true
    }

    pub fn set_daily_goal(&mut self, goal: u32) -> u32 {
        self.daily_goal = clamp_goal(goal);
        self.daily_goal
    }

    pub fn due_count(&self) -> u32 {
        let t = today().to_string();
        self.srs
            .values()
            .filter(|c| c.lang == self.lang && c.due <= t)
            .count() as u32
    }

    /// Tarjetas SRS activas del idioma actual (creadas, aunque no venzan).
    pub fn srs_count(&self) -> u32 {
        self.srs
            .values()
            .filter(|c| c.lang == self.lang)
            .count() as u32
    }

    pub fn words_learned(&self, lang: &str) -> u32 {
        self.srs
            .values()
            .filter(|c| c.lang == lang && c.reps > 0)
            .count() as u32
    }

    pub fn due_cards(&self, limit: usize) -> Vec<SrsCardDto> {
        let t = today().to_string();
        let mut cards: Vec<&SrsCard> = self
            .srs
            .values()
            .filter(|c| c.lang == self.lang && c.due <= t)
            .collect();
        cards.sort_by(|a, b| a.due.cmp(&b.due).then(b.lapses.cmp(&a.lapses)));
        cards
            .into_iter()
            .take(limit)
            .map(|c| SrsCardDto {
                es: c.es.clone(),
                t: c.t.clone(),
                due: c.due.clone(),
                reps: c.reps,
            })
            .collect()
    }

    /// Historial de XP de los últimos `HISTORY_DAYS` días (inclusive hoy).
    pub fn history_window(&self) -> Vec<DayXp> {
        let today = today();
        let start = (today - Duration::days(HISTORY_DAYS as i64 - 1)).to_string();
        let end = today.to_string();
        self.history
            .range(start..=end)
            .map(|(day, xp)| DayXp {
                day: day.clone(),
                xp: *xp,
            })
            .collect()
    }

    pub fn deck_cards(&self) -> Vec<PhraseDto> {
        self.deck
            .iter()
            .filter(|c| c.lang == self.lang)
            .cloned()
            .collect()
    }

    pub fn deck_count(&self) -> u32 {
        self.deck.iter().filter(|c| c.lang == self.lang).count() as u32
    }

    pub fn has_deck_card(&self, es: &str, t: &str) -> bool {
        self.deck.iter().any(|c| {
            c.lang == self.lang
                && card_key(&c.lang, &c.es, &c.t) == card_key(self.lang(), es, t)
        })
    }

    pub fn toggle_deck(&mut self, es: &str, t: &str) -> bool {
        if let Some(idx) = self.deck.iter().position(|c| {
            c.lang == self.lang
                && card_key(&c.lang, &c.es, &c.t) == card_key(self.lang(), es, t)
        }) {
            self.deck.remove(idx);
            return false;
        }
        self.deck
            .push(PhraseDto::new(self.lang(), es, t));
        true
    }

    pub fn clear_deck(&mut self) {
        self.deck.retain(|c| c.lang != self.lang);
    }

    fn snapshot_fields(&self) -> (u32, u32, u32, u32, bool, u32, u32) {
        let (level, _, level_xp) = level_parts(self.xp);
        let active_today = self.last_active.as_deref() == Some(&today().to_string());
        let xp_today = if self.xp_day.as_deref() == Some(&today().to_string()) {
            self.xp_today
        } else {
            0
        };
        (
            level,
            level_xp,
            level_needed(level),
            self.due_count(),
            active_today,
            xp_today,
            self.words_learned(self.lang()),
        )
    }

    pub fn snapshot(&self) -> ProgressState {
        let (level, level_xp, level_needed, due_count, active_today, xp_today, learned) =
            self.snapshot_fields();
        let title = level_parts(self.xp).1;
        ProgressState {
            xp: self.xp,
            level,
            level_title: title.to_string(),
            level_xp,
            level_needed,
            streak: self.streak,
            best_streak: self.best_streak,
            active_today,
            xp_today,
            daily_goal: self.daily_goal,
            total_correct: self.total_correct,
            total_answers: self.total_answers,
            words_learned: learned,
            due_count,
            srs_count: self.srs_count(),
            lessons: self.lessons.clone(),
            deck_count: self.deck_count(),
            lang: self.lang.clone(),
            history: self.history_window(),
        }
    }

    pub fn snapshot_ref(&self) -> SnapshotRef<'_> {
        let (level, level_xp, level_needed, due_count, active_today, xp_today, learned) =
            self.snapshot_fields();
        let idx = (level as usize - 1).min(TITLES.len() - 1);
        SnapshotRef {
            xp: self.xp,
            level,
            level_title: TITLES[idx],
            level_xp,
            level_needed,
            streak: self.streak,
            best_streak: self.best_streak,
            active_today,
            xp_today,
            daily_goal: self.daily_goal,
            total_correct: self.total_correct,
            total_answers: self.total_answers,
            words_learned: learned,
            due_count,
            srs_count: self.srs_count(),
            lessons: &self.lessons,
            deck_count: self.deck_count(),
            lang: &self.lang,
            history: self.history_window(),
        }
    }

    pub fn session(
        &mut self,
        lesson_id: Option<&str>,
        correct: u32,
        total: u32,
        combo_max: u32,
        rounds: &[RoundResult],
    ) -> SessionSummary {
        let rounds_ok = rounds.iter().filter(|r| r.correct).count() as u32;
        let rounds_total = rounds
            .iter()
            .filter(|r| !r.es.trim().is_empty() && !r.t.trim().is_empty())
            .count() as u32;
        let (answers_correct, answers_total) = if rounds_total > 0 {
            (rounds_ok, rounds_total)
        } else {
            (correct, total)
        };
        let accuracy = answers_correct
            .checked_mul(100)
            .and_then(|v| v.checked_div(answers_total))
            .unwrap_or(0);
        let mut xp_gained = answers_correct * 10 + combo_max * 2;
        if answers_total > 0 && accuracy == 100 {
            xp_gained += 25;
        } else if accuracy >= 80 {
            xp_gained += 10;
        }

        let (level_before, _, _) = level_parts(self.xp);
        self.xp += xp_gained;

        let tstr = today().to_string();
        if self.xp_day.as_deref() != Some(&tstr) {
            self.xp_day = Some(tstr.clone());
            self.xp_today = 0;
        }
        self.xp_today += xp_gained;
        *self.history.entry(tstr.clone()).or_insert(0) += xp_gained;

        let mut streak_up = false;
        match self.last_active.as_deref() {
            Some(day) if day == tstr => {}
            Some(day) if day == (today() - Duration::days(1)).to_string() => {
                self.streak += 1;
                streak_up = true;
            }
            _ => {
                self.streak = 1;
                streak_up = true;
            }
        }
        self.last_active = Some(tstr);
        self.best_streak = self.best_streak.max(self.streak);
        self.total_correct += answers_correct;
        self.total_answers += answers_total;

        let stars = stars_for(accuracy);
        if let Some(id) = lesson_id {
            let lp = self.lessons.entry(id.to_string()).or_default();
            lp.times += 1;
            lp.best_accuracy = lp.best_accuracy.max(accuracy);
            lp.stars = lp.stars.max(stars);
        }

        let new_words = self.apply_rounds(rounds);

        let (level, level_title, level_xp) = level_parts(self.xp);
        SessionSummary {
            xp_gained,
            total_xp: self.xp,
            streak: self.streak,
            streak_up,
            best_streak: self.best_streak,
            level,
            level_title: level_title.to_string(),
            level_up: level > level_before,
            level_xp,
            level_needed: level_needed(level),
            accuracy,
            correct: answers_correct,
            total: answers_total,
            combo_max,
            stars,
            new_words,
            due_count: self.due_count(),
            words_learned: self.words_learned(self.lang()),
            save_ok: true,
        }
    }

    fn apply_rounds(&mut self, rounds: &[RoundResult]) -> Vec<PhraseDto> {
        let tstr = today().to_string();
        let lang = self.lang().to_string();
        let mut fresh: Vec<PhraseDto> = Vec::new();
        let mut seen: Vec<String> = Vec::new();
        for r in rounds {
            let es = r.es.trim();
            let t = r.t.trim();
            if es.is_empty() || t.is_empty() {
                continue;
            }
            let key = card_key(&lang, es, t);
            let is_new = !self.srs.contains_key(&key);
            let card = self.srs.entry(key.clone()).or_insert_with(|| SrsCard {
                es: es.to_string(),
                t: t.to_string(),
                lang: lang.clone(),
                ease: 2.0,
                interval: 0,
                reps: 0,
                lapses: 0,
                due: tstr.clone(),
            });
            if r.correct {
                card.reps += 1;
                card.interval = match card.interval {
                    0 => 1,
                    1 => 3,
                    n => ((n as f32) * card.ease).round().max(4.0) as u32,
                };
                card.ease = (card.ease + 0.08).min(2.7);
                card.due = (today() + Duration::days(card.interval as i64)).to_string();
                if is_new && !seen.contains(&key) {
                    seen.push(key);
                    fresh.push(PhraseDto {
                        es: card.es.clone(),
                        t: card.t.clone(),
                        lang: card.lang.clone(),
                    });
                }
            } else {
                card.lapses += 1;
                card.interval = 0;
                card.ease = (card.ease - 0.2).max(1.3);
                card.due = (today() + Duration::days(1)).to_string();
            }
        }
        fresh
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round(es: &str, t: &str, correct: bool) -> RoundResult {
        RoundResult {
            es: es.into(),
            t: t.into(),
            correct,
        }
    }

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tualingua-test-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn level_curve_is_progressive() {
        assert_eq!(level_needed(1), 400);
        assert_eq!(level_needed(2), 550);
        assert_eq!(level_needed(8), 1450);
        assert_eq!(level_needed(9), 1500);
        assert_eq!(level_needed(100), 1500);
    }

    #[test]
    fn level_of_walks_the_curve() {
        let (l, _, x) = level_parts(0);
        assert_eq!((l, x), (1, 0));
        let (l, _, x) = level_parts(399);
        assert_eq!((l, x), (1, 399));
        let (l, _, x) = level_parts(400);
        assert_eq!((l, x), (2, 0));
        let (l, _, x) = level_parts(949);
        assert_eq!((l, x), (2, 549));
        let (l, _, x) = level_parts(950);
        assert_eq!((l, x), (3, 0));
    }

    #[test]
    fn level_title_caps_at_last() {
        let huge = u32::MAX;
        let (level, title, _) = level_parts(huge);
        assert!(level > TITLES.len() as u32);
        assert_eq!(title, TITLES[TITLES.len() - 1]);
    }

    #[test]
    fn due_cards_include_first_try_lapses() {
        let mut db = Db::default();
        let t = today().to_string();
        db.srs.insert(
            "k".to_string(),
            SrsCard {
                es: "ayer".to_string(),
                t: "yesterday".to_string(),
                lang: "en".to_string(),
                ease: 2.0,
                interval: 0,
                reps: 0,
                lapses: 1,
                due: t,
            },
        );
        assert_eq!(db.due_count(), 1);
        assert_eq!(db.due_cards(10).len(), 1);
        assert_eq!(db.words_learned("en"), 0);
    }

    #[test]
    fn bug_flag_due_count_must_match_due_cards() {
        let mut db = Db::default();
        let t = today().to_string();
        for i in 0..5 {
            db.srs.insert(
                format!("k{i}"),
                SrsCard {
                    es: format!("es{i}"),
                    t: format!("t{i}"),
                    lang: "en".to_string(),
                    ease: 2.0,
                    interval: 0,
                    reps: 0,
                    lapses: 1,
                    due: t.clone(),
                },
            );
        }
        assert_eq!(db.due_count() as usize, db.due_cards(100).len());
    }

    #[test]
    fn accuracy_uses_rounds_when_present() {
        let mut db = Db::default();
        let rounds = vec![
            round("a", "b", true),
            round("c", "d", true),
            round("e", "f", false),
        ];
        let s = db.session(Some("u1l1"), 2, 2, 1, &rounds);
        assert_eq!((s.correct, s.total, s.accuracy), (2, 3, 66));
        assert_eq!(db.total_correct, 2);
        assert_eq!(db.total_answers, 3);
    }

    #[test]
    fn accuracy_falls_back_without_rounds() {
        let mut db = Db::default();
        let s = db.session(None, 3, 4, 0, &[]);
        assert_eq!((s.correct, s.total, s.accuracy), (3, 4, 75));
        assert_eq!(db.total_correct, 3);
        assert_eq!(db.total_answers, 4);
    }

    #[test]
    fn srs_intervals_remember_lapses() {
        let mut db = Db::default();
        db.session(None, 1, 1, 0, &[round("a", "b", true)]);
        let card = db.srs.values().next().unwrap().clone();
        assert_eq!(card.interval, 1);
        assert_eq!(card.reps, 1);

        db.session(None, 0, 1, 0, &[round("a", "b", false)]);
        let card = db.srs.values().next().unwrap().clone();
        assert_eq!(card.interval, 0);
        assert_eq!(card.lapses, 1);
        assert!(card.ease >= 1.3);
    }

    #[test]
    fn srs_keys_separate_languages() {
        let mut db = Db::default();
        db.session(None, 1, 2, 0, &[round("la pizza", "pizza", true)]);
        assert!(db.set_language("ru"));
        db.session(None, 1, 2, 0, &[round("la pizza", "пицца", true)]);
        assert_eq!(db.srs.len(), 2);
        assert!(db.srs.values().any(|c| c.t == "pizza" && c.lang == "en"));
        assert!(db.srs
            .values()
            .any(|c| c.t == "пицца" && c.lang == "ru"));
    }

    #[test]
    fn deck_toggles_case_insensitive_and_per_lang() {
        let mut db = Db::default();
        assert!(db.toggle_deck("Perro", "Dog"));
        assert_eq!(db.deck_count(), 1);
        assert_eq!(db.snapshot().deck_count, 1);
        assert!(!db.toggle_deck("perro", "dog"));
        assert_eq!(db.deck_count(), 0);

        assert!(db.set_language("ru"));
        assert!(db.toggle_deck("el perro", "собака"));
        assert_eq!(db.deck_count(), 1);
        db.deck.iter().for_each(|c| assert_eq!(c.lang, "ru"));
        assert!(db.set_language("en"));
        assert_eq!(db.deck_count(), 0);
        assert_eq!(db.deck.len(), 1);
    }

    #[test]
    fn clear_deck_keeps_other_languages() {
        let mut db = Db::default();
        db.toggle_deck("hello", "hola");
        assert!(db.set_language("ru"));
        db.toggle_deck("hola", "привет");
        db.set_language("ru");
        db.clear_deck();
        assert_eq!(db.deck.len(), 1);
        assert_eq!(db.deck[0].lang, "en");
    }

    #[test]
    fn progress_json_with_old_files_still_parses() {
        let raw = r#"{
            "xp": 5, "xp_today": 2, "xp_day": "2026-10-20",
            "streak": 3, "best_streak": 4, "last_active": "2026-10-20",
            "lessons": {}, "srs": {}, "total_correct": 10, "total_answers": 12
        }"#;
        let db: Db = serde_json::from_str(raw).unwrap();
        assert_eq!(db.xp, 5);
        assert_eq!(db.deck_count(), 0);
        assert_eq!(db.lang, "en");
        // Archivos sin version se tratan como v1 (en alias vigente).
        assert_eq!(db.version, 1);
        assert_eq!(db.daily_goal, DEFAULT_DAILY_GOAL);
        assert!(db.history.is_empty());
    }

    #[test]
    fn old_srs_and_deck_with_en_field_migrate() {
        let raw = r#"{
            "xp": 0, "xp_today": 0, "xp_day": null,
            "streak": 0, "best_streak": 0, "last_active": null,
            "lessons": {}, "total_correct": 0, "total_answers": 0,
            "srs": {
                "hola|hello": {
                    "es": "Hola", "en": "Hello", "ease": 2.5,
                    "interval": 3, "reps": 2, "lapses": 0, "due": "2026-10-20"
                }
            },
            "deck": [{ "es": "Hola", "en": "Hello" }]
        }"#;
        let db = Db::load_from_str(raw);
        assert_eq!(db.srs.len(), 1);
        let card = db.srs.values().next().unwrap();
        assert_eq!(card.t, "Hello");
        assert_eq!(card.lang, "en");
        assert!(db.srs.contains_key("en|hola|hello"));
        assert_eq!(db.deck.len(), 1);
        assert_eq!(db.deck[0].t, "Hello");
        assert_eq!(db.deck[0].lang, "en");
    }

    #[test]
    fn set_language_validates() {
        let mut db = Db::default();
        assert!(db.set_language("ru"));
        assert_eq!(db.lang, "ru");
        assert!(!db.set_language("xx"));
        assert_eq!(db.lang, "ru");
        assert!(db.set_language("en"));
        assert_eq!(db.lang, "en");
    }

    #[test]
    fn daily_goal_is_clamped_and_visible_in_snapshot() {
        let mut db = Db::default();
        assert_eq!(db.set_daily_goal(5), MIN_DAILY_GOAL);
        assert_eq!(db.set_daily_goal(9999), MAX_DAILY_GOAL);
        assert_eq!(db.set_daily_goal(50), 50);
        let snap = db.snapshot_ref();
        assert_eq!(snap.daily_goal, 50);
        assert!(snap.history.is_empty());
    }

    #[test]
    fn session_records_xp_history() {
        let mut db = Db::default();
        db.session(None, 3, 4, 0, &[]);
        let t = today().to_string();
        assert_eq!(db.history.get(t.as_str()), Some(&30));
        let window = db.history_window();
        assert_eq!(window.len(), 1);
        assert_eq!(window[0].day, t);
        assert_eq!(window[0].xp, 30);
        assert_eq!(db.snapshot_ref().history, window);
    }

    #[test]
    fn snapshot_ref_json_matches_snapshot() {
        let mut db = Db::default();
        db.session(Some("u1l1"), 2, 3, 2, &[round("a", "b", true), round("c", "d", false)]);
        assert!(db.toggle_deck("Perro", "Dog"));
        let full = serde_json::to_string(&db.snapshot()).unwrap();
        let light = serde_json::to_string(&db.snapshot_ref()).unwrap();
        let a: serde_json::Value = serde_json::from_str(&full).unwrap();
        let b: serde_json::Value = serde_json::from_str(&light).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn save_load_roundtrip_and_rotate_backups() {
        let dir = temp_dir("save");
        let path = dir.join("progress.json");

        let mut db = Db::default();
        db.session(Some("u1l1"), 1, 2, 0, &[round("a", "b", true)]);
        db.save(&path).expect("primer guardado");
        assert!(path.exists());
        assert!(!backup_path(&path, 1).exists());

        let mut db2 = Db::load(&path);
        db2.session(None, 2, 3, 0, &[]);
        db2.save(&path).expect("segundo guardado");

        // .bak1 conserva el estado tras el primer guardado
        assert_eq!(Db::load(&backup_path(&path, 1)).xp, db.xp);

        let loaded = Db::load(&path);
        assert_eq!(loaded.xp, db2.xp);
        assert_eq!(loaded.streak, 1);

        for _ in 0..SAVE_BACKUPS {
            db2.save(&path).expect("guardados de rotación");
        }
        for n in 1..=SAVE_BACKUPS {
            assert!(backup_path(&path, n).exists(), "falta .bak{n}");
        }
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn save_reports_errors_deterministically() {
        let dir = temp_dir("blocked");
        std::fs::create_dir_all(&dir).expect("tempdir");
        let blocker = dir.join("es-un-archivo");
        std::fs::write(&blocker, "x").expect("bloqueo");
        let bad = blocker.join("progress.json");
        let mut db = Db::default();
        db.session(None, 1, 1, 0, &[]);
        assert!(db.save(&bad).is_err());
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn export_import_roundtrip_preserves_everything() {
        let mut db = Db::default();
        db.session(Some("u1l1"), 4, 5, 3, &[round("a", "b", true), round("c", "d", false)]);
        db.toggle_deck("Perro", "Dog");
        let raw = db.export_json().expect("export");
        let restored = Db::import_from_str(&raw).expect("import");
        assert_eq!(restored.xp, db.xp);
        assert_eq!(restored.streak, db.streak);
        assert_eq!(restored.deck, db.deck);
        assert_eq!(restored.srs, db.srs);
        assert_eq!(restored.lessons, db.lessons);
        assert_eq!(restored.history, db.history);
        assert_eq!(restored.version, SCHEMA_VERSION);
        assert_eq!(restored, db);
    }

    #[test]
    fn import_rejects_corrupt_and_future_versions() {
        assert!(Db::import_from_str("esto no es json").is_err());
        let mut db = Db::default();
        db.session(None, 1, 1, 0, &[]);
        let mut v: serde_json::Value =
            serde_json::from_str(&db.export_json().unwrap()).unwrap();

        v.as_object_mut()
            .unwrap()
            .insert("version".into(), serde_json::json!(99));
        let raw_future = serde_json::to_string(&v).unwrap();
        let err = Db::import_from_str(&raw_future).unwrap_err();
        assert!(err.contains("más nueva"), "{err}");

        // sin campo version = archivo antiguo v1: se acepta
        v.as_object_mut().unwrap().remove("version");
        let raw_old = serde_json::to_string(&v).unwrap();
        let imported = Db::import_from_str(&raw_old).expect("v1 importable");
        assert_eq!(imported.version, SCHEMA_VERSION);
    }

    #[test]
    fn export_to_path_writes_file() {
        let dir = temp_dir("export");
        let target = dir.join("sub").join("backup.json");
        let raw = Db::default().export_json().unwrap();
        Db::export_to_path(&target, &raw).expect("export a ruta");
        assert!(target.exists());
        let _ = std::fs::remove_dir_all(dir);
    }
}
