use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Serialize, Deserialize, Clone)]
pub struct Phrase {
    pub es: String,
    #[serde(alias = "en")]
    pub t: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct LanguageInfo {
    pub id: String,
    pub title: String,
    pub emoji: String,
    pub bcp47: String,
    pub level: String,
}

const EN_SOURCES: [&str; 12] = [
    include_str!("content/u1.json"),
    include_str!("content/u2.json"),
    include_str!("content/u3.json"),
    include_str!("content/u4.json"),
    include_str!("content/u5.json"),
    include_str!("content/u6.json"),
    include_str!("content/u7.json"),
    include_str!("content/u8.json"),
    include_str!("content/u9.json"),
    include_str!("content/u10.json"),
    include_str!("content/u11.json"),
    include_str!("content/u12.json"),
];

const RU_SOURCES: [&str; 8] = [
    include_str!("content/r1.json"),
    include_str!("content/r2.json"),
    include_str!("content/r3.json"),
    include_str!("content/r4.json"),
    include_str!("content/r5.json"),
    include_str!("content/r6.json"),
    include_str!("content/r7.json"),
    include_str!("content/r8.json"),
];

fn sources(id: &str) -> Option<&[&str]> {
    match id {
        "en" => Some(&EN_SOURCES),
        "ru" => Some(&RU_SOURCES),
        _ => None,
    }
}

pub const EN: &str = "en";

fn parse_units(srcs: &[&str]) -> Result<Vec<Unit>, String> {
    srcs.iter()
        .map(|s| serde_json::from_str::<Unit>(s).map_err(|e| format!("contenido JSON inválido: {e}")))
        .collect()
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ExerciseKind {
    Choice {
        options: Vec<String>,
        answer: usize,
    },
    Listen {
        audio: String,
        options: Vec<String>,
        answer: usize,
    },
    Build {
        solution: String,
        distractors: Vec<String>,
    },
    Match {
        pairs: Vec<Phrase>,
    },
    Type {
        solution: String,
        accept: Vec<String>,
    },
    Fill {
        sentence: String,
        options: Vec<String>,
        answer: usize,
    },
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Exercise {
    pub id: String,
    pub prompt: String,
    #[serde(flatten)]
    pub kind: ExerciseKind,
    #[serde(default)]
    pub pair: Option<Phrase>,
    #[serde(default)]
    pub explain: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Lesson {
    pub id: String,
    pub title: String,
    pub goal: String,
    pub tip: Vec<String>,
    pub phrases: Vec<Phrase>,
    pub exercises: Vec<Exercise>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Unit {
    pub id: String,
    pub title: String,
    pub emoji: String,
    pub color: String,
    pub lessons: Vec<Lesson>,
}

static LANGS: OnceLock<Vec<LanguageInfo>> = OnceLock::new();

fn language_info() -> &'static Vec<LanguageInfo> {
    LANGS.get_or_init(|| {
        vec![
            LanguageInfo {
                id: "en".into(),
                title: "Inglés".into(),
                emoji: "🇬🇧".into(),
                bcp47: "en-US".into(),
                level: "A1–B2".into(),
            },
            LanguageInfo {
                id: "ru".into(),
                title: "Ruso".into(),
                emoji: "🇷🇺".into(),
                bcp47: "ru-RU".into(),
                level: "A1–B2".into(),
            },
        ]
    })
}

pub fn languages() -> &'static [LanguageInfo] {
    language_info()
}

pub fn normalize_lang(id: &str) -> &'static str {
    languages()
        .iter()
        .find(|l| l.id == id)
        .map(|l| l.id.as_str())
        .unwrap_or(EN)
}

static CATALOGS: OnceLock<HashMap<String, Vec<Unit>>> = OnceLock::new();

fn init_catalogs() -> Result<HashMap<String, Vec<Unit>>, String> {
    let mut map = HashMap::new();
    for l in languages() {
        let srcs = sources(&l.id).ok_or_else(|| format!("{} sin fuentes", l.id))?;
        map.insert(l.id.clone(), parse_units(srcs)?);
    }
    Ok(map)
}

pub fn catalog(id: &str) -> &'static [Unit] {
    let catalogs = CATALOGS.get_or_init(|| {
        init_catalogs().expect("contenido de unidades inválido")
    });
    catalogs
        .get(normalize_lang(id))
        .map(|v| v.as_slice())
        .unwrap()
}

/// Catálogo ya serializado (por idioma), cacheado para no re-serializar el
/// contenido completo en cada llamada IPC.
pub fn catalog_json(id: &str) -> &'static serde_json::Value {
    static CATALOG_JSON: OnceLock<HashMap<String, serde_json::Value>> = OnceLock::new();
    let map = CATALOG_JSON.get_or_init(|| {
        catalog(EN); // valida contenido antes de serializar
        languages()
            .iter()
            .map(|l| {
                let v = serde_json::to_value(catalog(&l.id)).expect("serializar catálogo");
                (l.id.clone(), v)
            })
            .collect()
    });
    map
        .get(normalize_lang(id))
        .expect("catálogo json del idioma")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_json_matches_catalog() {
        for lang in ["en", "ru"] {
            let units = catalog(lang);
            let value = catalog_json(lang);
            let arr = value.as_array().expect("catálogo json es un array");
            assert_eq!(arr.len(), units.len());
            for (unit, json) in units.iter().zip(arr) {
                assert_eq!(json.get("id"), Some(&serde_json::json!(unit.id)));
                assert_eq!(
                    json.get("title").and_then(|t| t.as_str()),
                    Some(unit.title.as_str())
                );
            }
        }
        let _ = catalog_json("desconocido"); // cae al inglés sin paniquear
    }

    fn assert_capitalized(es: &str, t: &str, label: &str) {
        if let Some(c) = es.chars().next() {
            assert!(!c.is_lowercase(), "pair.es minúscula en {label}: {es}");
        }
        if let Some(c) = t.chars().next() {
            assert!(!c.is_lowercase(), "pair.t minúscula en {label}: {t}");
        }
    }

    fn validate(id: &str, expect_units: usize, min_exercises: usize) -> usize {
        let units = catalog(id);
        assert_eq!(units.len(), expect_units);
        let mut ids = std::collections::HashSet::new();
        let mut exercises = 0usize;
        for unit in units {
            assert!(!unit.lessons.is_empty());
            for lesson in &unit.lessons {
                assert!(
                    ids.insert(lesson.id.clone()),
                    "lección duplicada {}",
                    lesson.id
                );
                assert!(!lesson.phrases.is_empty());
                assert!(lesson.exercises.len() >= 6);
                for phrase in &lesson.phrases {
                    assert_capitalized(&phrase.es, &phrase.t, &lesson.id);
                }
                for ex in &lesson.exercises {
                    assert!(ids.insert(ex.id.clone()), "ejercicio duplicado {}", ex.id);
                    exercises += 1;
                    match &ex.kind {
                        ExerciseKind::Choice { options, answer }
                        | ExerciseKind::Listen {
                            options, answer, ..
                        }
                        | ExerciseKind::Fill {
                            options, answer, ..
                        } => {
                            assert!(*answer < options.len());
                            assert!(options.len() >= 2);
                        }
                        ExerciseKind::Build { solution, .. } => assert!(!solution.is_empty()),
                        ExerciseKind::Type { solution, .. } => assert!(!solution.is_empty()),
                        ExerciseKind::Match { pairs } => assert!(pairs.len() >= 3),
                    }
                    if let Some(pair) = &ex.pair {
                        assert_capitalized(&pair.es, &pair.t, &ex.id);
                        assert!(!pair.es.trim().is_empty());
                        assert!(!pair.t.trim().is_empty());
                    }
                    match &ex.kind {
                        ExerciseKind::Choice { .. }
                        | ExerciseKind::Fill { .. }
                        | ExerciseKind::Listen { .. }
                        | ExerciseKind::Build { .. }
                        | ExerciseKind::Type { .. } => {
                            assert!(ex.pair.is_some(), "{} sin pair", ex.id);
                        }
                        ExerciseKind::Match { pairs } => {
                            for pair in pairs {
                                assert_capitalized(&pair.es, &pair.t, &ex.id);
                            }
                        }
                    }
                }
            }
        }
        assert!(
            exercises >= min_exercises,
            "{id}: se esperaban al menos {min_exercises} ejercicios, hay {exercises}"
        );
        exercises
    }

    fn cyrillic_count(s: &str) -> usize {
        s.chars().filter(|c| ('\u{0400}'..='\u{04FF}').contains(c)).count()
    }

    #[test]
    fn catalog_is_valid() {
        let en_exercises = validate("en", 12, 340);
        let ru_exercises = validate("ru", 8, 230);
        assert!(
            en_exercises + ru_exercises >= 580,
            "total {en_exercises} + {ru_exercises}"
        );
    }

    #[test]
    fn russian_content_uses_cyrillic() {
        for unit in catalog("ru") {
            for lesson in &unit.lessons {
                for phrase in &lesson.phrases {
                    assert!(
                        cyrillic_count(&phrase.t) > 0,
                        "frase sin cirílico en {}: {}",
                        lesson.id,
                        phrase.t
                    );
                }
                for ex in &lesson.exercises {
                    if let Some(pair) = &ex.pair {
                        assert!(
                            cyrillic_count(&pair.t) > 0,
                            "pair sin cirílico en {}: {}",
                            ex.id,
                            pair.t
                        );
                    }
                    match &ex.kind {
                        ExerciseKind::Listen { audio, .. } => {
                            assert!(cyrillic_count(audio) > 0, "audio sin cirílico en {}", ex.id);
                        }
                        ExerciseKind::Build { solution, .. }
                        | ExerciseKind::Type { solution, .. } => {
                            assert!(cyrillic_count(solution) > 0, "solución sin cirílico en {}", ex.id);
                        }
                        ExerciseKind::Match { pairs } => {
                            for pair in pairs {
                                assert!(cyrillic_count(&pair.t) > 0, "match sin cirílico en {}", ex.id);
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    #[test]
    fn english_content_has_no_cyrillic() {
        for unit in catalog("en") {
            for lesson in &unit.lessons {
                for phrase in &lesson.phrases {
                    assert_eq!(cyrillic_count(&phrase.t), 0, "{}", lesson.id);
                }
                for ex in &lesson.exercises {
                    if let Some(pair) = &ex.pair {
                        assert_eq!(cyrillic_count(&pair.t), 0, "{}", ex.id);
                    }
                }
            }
        }
    }

    #[test]
    fn languages_metadata_is_consistent() {
        for lang in languages() {
            assert!(sources(&lang.id).is_some(), "{} sin fuentes", lang.id);
            assert!(lang.bcp47.contains('-'), "bcp47 inválido {}", lang.bcp47);
            assert!(catalog(&lang.id).len() > 0);
        }
        assert_eq!(normalize_lang("ru"), "ru");
        assert_eq!(normalize_lang("xx"), "en");
    }
}
