use crate::catalog::{normalize_lang, Phrase};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Serialize, Deserialize, Clone)]
pub struct DictEntry {
    #[serde(alias = "en")]
    pub t: String,
    pub es: String,
    #[serde(default)]
    pub pos: Option<String>,
    #[serde(default)]
    pub ex: Option<Phrase>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DictCategory {
    pub id: String,
    pub title: String,
    pub emoji: String,
    pub words: Vec<DictEntry>,
}

const SOURCES: [(&str, &str); 4] = [
    ("en", include_str!("content/dictionary.json")),
    ("ru", include_str!("content/dictionary_ru.json")),
    ("it", include_str!("content/dictionary_it.json")),
    ("zh", include_str!("content/dictionary_zh.json")),
];

static DICTIONARIES: OnceLock<HashMap<String, Vec<DictCategory>>> = OnceLock::new();

fn init_dictionaries() -> HashMap<String, Vec<DictCategory>> {
    SOURCES
        .iter()
        .map(|(id, src)| {
            (
                id.to_string(),
                serde_json::from_str::<Vec<DictCategory>>(src)
                    .expect("diccionario JSON inválido"),
            )
        })
        .collect()
}

pub fn dictionary(lang: &str) -> &'static [DictCategory] {
    let dicts = DICTIONARIES.get_or_init(init_dictionaries);
    dicts
        .get(normalize_lang(lang))
        .map(|v| v.as_slice())
        .unwrap()
}

/// Diccionario ya serializado (por idioma), cacheado para no re-serializar
/// en cada llamada IPC.
pub fn dictionary_json(lang: &str) -> &'static serde_json::Value {
    static DICT_JSON: OnceLock<HashMap<String, serde_json::Value>> = OnceLock::new();
    let json = DICT_JSON.get_or_init(|| {
        dictionary("en");
        SOURCES
            .iter()
            .map(|(id, _)| {
                let v = serde_json::to_value(dictionary(id)).expect("serializar diccionario");
                (id.to_string(), v)
            })
            .collect()
    });
    json
        .get(normalize_lang(lang))
        .expect("diccionario json del idioma")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::languages;

    #[test]
    fn dictionary_json_matches_dictionary() {
        for lang in ["en", "ru", "it", "zh"] {
            let cats = dictionary(lang);
            let value = dictionary_json(lang);
            let arr = value.as_array().expect("diccionario json es un array");
            assert_eq!(arr.len(), cats.len());
            for (cat, json) in cats.iter().zip(arr) {
                assert_eq!(json.get("id"), Some(&serde_json::json!(cat.id)));
            }
        }
    }

    #[test]
    fn dictionary_is_valid() {
        for lang in languages() {
            let cats = dictionary(&lang.id);
            assert!(
                cats.len() >= 10,
                "{}: se esperaban >= 10 categorías",
                lang.id
            );
            let mut ids = std::collections::HashSet::new();
            let mut seen = std::collections::HashSet::new();
            for cat in cats {
                assert!(
                    ids.insert(cat.id.as_str()),
                    "{} categoría duplicada {}",
                    lang.id,
                    cat.id
                );
                assert!(!cat.title.trim().is_empty());
                assert!(cat.words.len() >= 10, "{} con pocas palabras", cat.id);
                for w in &cat.words {
                    assert!(!w.t.trim().is_empty(), "{}: t vacío en {}", lang.id, cat.id);
                    assert!(!w.es.trim().is_empty(), "{}: es vacío en {}", lang.id, cat.id);
                    assert!(
                        seen.insert(w.t.to_lowercase()),
                        "{}: palabra duplicada: {}",
                        lang.id,
                        w.t
                    );
                    assert!(
                        w.pos.as_deref().map_or(false, |p| matches!(p, "n" | "v" | "adj" | "adv" | "phr")),
                        "{}: pos inválida en {}",
                        lang.id,
                        w.t
                    );
                    if let Some(ex) = &w.ex {
                        assert!(!ex.t.trim().is_empty());
                        assert!(!ex.es.trim().is_empty());
                    }
                }
            }
        }
    }
}
