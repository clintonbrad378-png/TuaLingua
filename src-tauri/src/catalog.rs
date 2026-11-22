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

const EN_SOURCES: [&str; 16] = [
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
    include_str!("content/u13.json"),
    include_str!("content/u14.json"),
    include_str!("content/u15.json"),
    include_str!("content/u16.json"),
];

const RU_SOURCES: [&str; 12] = [
    include_str!("content/r1.json"),
    include_str!("content/r2.json"),
    include_str!("content/r3.json"),
    include_str!("content/r4.json"),
    include_str!("content/r5.json"),
    include_str!("content/r6.json"),
    include_str!("content/r7.json"),
    include_str!("content/r8.json"),
    include_str!("content/r9.json"),
    include_str!("content/r10.json"),
    include_str!("content/r11.json"),
    include_str!("content/r12.json"),
];

const ZH_SOURCES: [&str; 8] = [
    include_str!("content/c1.json"),
    include_str!("content/c2.json"),
    include_str!("content/c3.json"),
    include_str!("content/c4.json"),
    include_str!("content/c5.json"),
    include_str!("content/c6.json"),
    include_str!("content/c7.json"),
    include_str!("content/c8.json"),
];

const FR_SOURCES: [&str; 8] = [
    include_str!("content/f1.json"),
    include_str!("content/f2.json"),
    include_str!("content/f3.json"),
    include_str!("content/f4.json"),
    include_str!("content/f5.json"),
    include_str!("content/f6.json"),
    include_str!("content/f7.json"),
    include_str!("content/f8.json"),
];

const AR_SOURCES: [&str; 8] = [
    include_str!("content/a1.json"),
    include_str!("content/a2.json"),
    include_str!("content/a3.json"),
    include_str!("content/a4.json"),
    include_str!("content/a5.json"),
    include_str!("content/a6.json"),
    include_str!("content/a7.json"),
    include_str!("content/a8.json"),
];

const DE_SOURCES: [&str; 8] = [
    include_str!("content/d1.json"),
    include_str!("content/d2.json"),
    include_str!("content/d3.json"),
    include_str!("content/d4.json"),
    include_str!("content/d5.json"),
    include_str!("content/d6.json"),
    include_str!("content/d7.json"),
    include_str!("content/d8.json"),
];

const PT_SOURCES: [&str; 8] = [
    include_str!("content/p1.json"),
    include_str!("content/p2.json"),
    include_str!("content/p3.json"),
    include_str!("content/p4.json"),
    include_str!("content/p5.json"),
    include_str!("content/p6.json"),
    include_str!("content/p7.json"),
    include_str!("content/p8.json"),
];

const IT_SOURCES: [&str; 8] = [
    include_str!("content/i1.json"),
    include_str!("content/i2.json"),
    include_str!("content/i3.json"),
    include_str!("content/i4.json"),
    include_str!("content/i5.json"),
    include_str!("content/i6.json"),
    include_str!("content/i7.json"),
    include_str!("content/i8.json"),
];

fn sources(id: &str) -> Option<&[&str]> {
    match id {
        "en" => Some(&EN_SOURCES),
        "ru" => Some(&RU_SOURCES),
        "it" => Some(&IT_SOURCES),
        "zh" => Some(&ZH_SOURCES),
        "fr" => Some(&FR_SOURCES),
        "ar" => Some(&AR_SOURCES),
        "de" => Some(&DE_SOURCES),
        "pt" => Some(&PT_SOURCES),
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
            LanguageInfo {
                id: "it".into(),
                title: "Italiano".into(),
                emoji: "🇮🇹".into(),
                bcp47: "it-IT".into(),
                level: "A1–B1".into(),
            },
            LanguageInfo {
                id: "zh".into(),
                title: "Chino mandarín".into(),
                emoji: "🇨🇳".into(),
                bcp47: "zh-CN".into(),
                level: "A1–B1".into(),
            },
            LanguageInfo {
                id: "fr".into(),
                title: "Francés".into(),
                emoji: "🇫🇷".into(),
                bcp47: "fr-FR".into(),
                level: "A1–B1".into(),
            },
            LanguageInfo {
                id: "ar".into(),
                title: "Árabe".into(),
                emoji: "🇸🇦".into(),
                bcp47: "ar-SA".into(),
                level: "A1–B1".into(),
            },
            LanguageInfo {
                id: "de".into(),
                title: "Alemán".into(),
                emoji: "🇩🇪".into(),
                bcp47: "de-DE".into(),
                level: "A1–B1".into(),
            },
            LanguageInfo {
                id: "pt".into(),
                title: "Portugués".into(),
                emoji: "🇵🇹".into(),
                bcp47: "pt-BR".into(),
                level: "A1–B1".into(),
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
        for lang in ["en", "ru", "it"] {
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

    fn hanzi_count(s: &str) -> usize {
        s.chars().filter(|c| ('\u{4E00}'..='\u{9FFF}').contains(c)).count()
    }

    #[test]
    fn catalog_is_valid() {
        let en_exercises = validate("en", 16, 460);
        let ru_exercises = validate("ru", 12, 350);
        let it_exercises = validate("it", 8, 220);
        let zh_exercises = validate("zh", 8, 220);
        let fr_exercises = validate("fr", 8, 220);
        let ar_exercises = validate("ar", 8, 220);
        let de_exercises = validate("de", 8, 220);
        let pt_exercises = validate("pt", 8, 220);
        assert!(
            en_exercises + ru_exercises + it_exercises + zh_exercises + fr_exercises + ar_exercises + de_exercises + pt_exercises >= 2200,
            "total {en_exercises} + {ru_exercises} + {it_exercises} + {zh_exercises}"
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
    fn italian_content_is_present() {
        for unit in catalog("it") {
            assert!(!unit.lessons.is_empty());
            for lesson in &unit.lessons {
                for phrase in &lesson.phrases {
                    assert!(!phrase.t.trim().is_empty());
                    assert!(!phrase.es.trim().is_empty());
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
    fn chinese_content_uses_hanzi() {
        for unit in catalog("zh") {
            assert!(
                unit.lessons
                    .iter()
                    .flat_map(|l| l.tip.iter())
                    .any(|tip| tip.contains("tono")),
                "{} no explica los tonos",
                unit.id
            );
            for lesson in &unit.lessons {
                for phrase in &lesson.phrases {
                    assert!(
                        hanzi_count(&phrase.t) > 0,
                        "frase sin hanzi en {}: {}",
                        lesson.id,
                        phrase.t
                    );
                    assert!(
                        phrase.t.contains('('),
                        "frase sin pinyin entre paréntesis en {}: {}",
                        lesson.id,
                        phrase.t
                    );
                }
                for ex in &lesson.exercises {
                    if let Some(pair) = &ex.pair {
                        assert!(
                            hanzi_count(&pair.t) > 0,
                            "pair sin hanzi en {}: {}",
                            ex.id,
                            pair.t
                        );
                    }
                    match &ex.kind {
                        ExerciseKind::Listen { audio, .. } => {
                            assert!(hanzi_count(audio) > 0, "audio sin hanzi en {}", ex.id);
                        }
                        ExerciseKind::Build { solution, .. }
                        | ExerciseKind::Type { solution, .. } => {
                            assert!(
                                hanzi_count(solution) > 0,
                                "solución sin hanzi en {}",
                                ex.id
                            );
                        }
                        ExerciseKind::Match { pairs } => {
                            for pair in pairs {
                                assert!(
                                    hanzi_count(&pair.t) > 0,
                                    "match sin hanzi en {}",
                                    ex.id
                                );
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    #[test]
    fn zh_type_accepts_pinyin_sin_tonos() {
        const TONES: &str = "āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ";
        for unit in catalog("zh") {
            for lesson in &unit.lessons {
                for ex in &lesson.exercises {
                    if let ExerciseKind::Type { solution, accept } = &ex.kind {
                        assert_eq!(
                            hanzi_count(solution),
                            solution.chars().count(),
                            "solution de type no es hanzi puro en {}",
                            ex.id
                        );
                        for a in accept {
                            assert!(
                                hanzi_count(a) > 0
                                    || !TONES.chars().any(|tone| a.contains(tone)),
                                "accept con pinyin tonalizado en {}: {}",
                                ex.id,
                                a
                            );
                        }
                    }
                }
            }
        }
    }

    fn arabic_count(s: &str) -> usize {
        s.chars().filter(|c| ('\u{0600}'..='\u{06FF}').contains(c) || ('\u{0750}'..='\u{077F}').contains(c)).count()
    }

    #[test]
    fn arabic_content_uses_arabic_script() {
        for unit in catalog("ar") {
            for lesson in &unit.lessons {
                for phrase in &lesson.phrases {
                    assert!(arabic_count(&phrase.t) > 0, "frase sin árabe en {}: {}", lesson.id, phrase.t);
                }
            }
        }
    }

    #[test]
    fn french_content_is_present() {
        for unit in catalog("fr") {
            assert!(!unit.lessons.is_empty());
            for lesson in &unit.lessons {
                for phrase in &lesson.phrases {
                    assert!(!phrase.t.trim().is_empty());
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
