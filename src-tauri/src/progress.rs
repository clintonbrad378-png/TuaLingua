use chrono::{Duration, Local, NaiveDate};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

pub const DAILY_GOAL: u32 = 60;
const LEVEL_STEP: u32 = 400;
const TITLES: [&str; 7] = [
    "Novato",
    "Curioso",
    "Charlatán",
    "Viajero",
    "Conversador",
    "Casi bilingüe",
    "Maestro del inglés",
];

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct LessonProgress {
    pub best_accuracy: u32,
    pub stars: u32,
    pub times: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SrsCard {
    pub es: String,
    pub en: String,
    pub ease: f32,
    pub interval: u32,
    pub reps: u32,
    pub lapses: u32,
    pub due: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
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
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RoundResult {
    pub es: String,
    pub en: String,
    pub correct: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SrsCardDto {
    pub es: String,
    pub en: String,
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
    pub lessons: HashMap<String, LessonProgress>,
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
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PhraseDto {
    pub es: String,
    pub en: String,
}

fn today() -> NaiveDate {
    Local::now().date_naive()
}

fn level_of(xp: u32) -> (u32, String, u32) {
    let level = xp / LEVEL_STEP + 1;
    let idx = (level as usize - 1).min(TITLES.len() - 1);
    (level, TITLES[idx].to_string(), xp % LEVEL_STEP)
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

impl Db {
    pub fn load(path: &Path) -> Self {
        std::fs::read_to_string(path)
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, path: &Path) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(raw) = serde_json::to_vec(self) {
            let tmp = path.with_extension("json.tmp");
            if std::fs::write(&tmp, raw).is_ok() {
                let _ = std::fs::rename(&tmp, path);
            }
        }
    }

    pub fn due_count(&self) -> u32 {
        let t = today().to_string();
        self.srs.values().filter(|c| c.due <= t).count() as u32
    }

    pub fn words_learned(&self) -> u32 {
        self.srs.values().filter(|c| c.reps > 0).count() as u32
    }

    pub fn due_cards(&self, limit: usize) -> Vec<SrsCardDto> {
        let t = today().to_string();
        let mut cards: Vec<&SrsCard> = self
            .srs
            .values()
            .filter(|c| c.due <= t && c.reps > 0)
            .collect();
        cards.sort_by(|a, b| a.due.cmp(&b.due).then(b.lapses.cmp(&a.lapses)));
        cards
            .into_iter()
            .take(limit)
            .map(|c| SrsCardDto {
                es: c.es.clone(),
                en: c.en.clone(),
                due: c.due.clone(),
                reps: c.reps,
            })
            .collect()
    }

    pub fn snapshot(&self) -> ProgressState {
        let (level, level_title, level_xp) = level_of(self.xp);
        ProgressState {
            xp: self.xp,
            level,
            level_title,
            level_xp,
            level_needed: LEVEL_STEP,
            streak: self.streak,
            best_streak: self.best_streak,
            active_today: self.last_active.as_deref() == Some(&today().to_string()),
            xp_today: if self.xp_day.as_deref() == Some(&today().to_string()) {
                self.xp_today
            } else {
                0
            },
            daily_goal: DAILY_GOAL,
            total_correct: self.total_correct,
            total_answers: self.total_answers,
            words_learned: self.words_learned(),
            due_count: self.due_count(),
            lessons: self.lessons.clone(),
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
        let accuracy = if total > 0 { correct * 100 / total } else { 0 };
        let mut xp_gained = correct * 10 + combo_max * 2;
        if total > 0 && accuracy == 100 {
            xp_gained += 25;
        } else if accuracy >= 80 {
            xp_gained += 10;
        }

        let (level_before, _, _) = level_of(self.xp);
        self.xp += xp_gained;

        let tstr = today().to_string();
        if self.xp_day.as_deref() != Some(&tstr) {
            self.xp_day = Some(tstr.clone());
            self.xp_today = 0;
        }
        self.xp_today += xp_gained;

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
        self.total_correct += correct;
        self.total_answers += total;

        let stars = stars_for(accuracy);
        if let Some(id) = lesson_id {
            let lp = self.lessons.entry(id.to_string()).or_default();
            lp.times += 1;
            lp.best_accuracy = lp.best_accuracy.max(accuracy);
            lp.stars = lp.stars.max(stars);
        }

        let new_words = self.apply_rounds(rounds);

        let (level, level_title, level_xp) = level_of(self.xp);
        SessionSummary {
            xp_gained,
            total_xp: self.xp,
            streak: self.streak,
            streak_up,
            best_streak: self.best_streak,
            level,
            level_title,
            level_up: level > level_before,
            level_xp,
            level_needed: LEVEL_STEP,
            accuracy,
            correct,
            total,
            combo_max,
            stars,
            new_words,
            due_count: self.due_count(),
            words_learned: self.words_learned(),
        }
    }

    fn apply_rounds(&mut self, rounds: &[RoundResult]) -> Vec<PhraseDto> {
        let tstr = today().to_string();
        let mut fresh: Vec<PhraseDto> = Vec::new();
        let mut seen: Vec<String> = Vec::new();
        for r in rounds {
            let es = r.es.trim();
            let en = r.en.trim();
            if es.is_empty() || en.is_empty() {
                continue;
            }
            let key = format!("{}|{}", es.to_lowercase(), en.to_lowercase());
            let is_new = !self.srs.contains_key(&key);
            let card = self.srs.entry(key.clone()).or_insert_with(|| SrsCard {
                es: es.to_string(),
                en: en.to_string(),
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
                        en: card.en.clone(),
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
