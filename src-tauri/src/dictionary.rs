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

const SOURCES: [(&str, &str); 2] = [
    ("en", include_str!("content/dictionary.json")),
    ("ru", include_str!("content/dictionary_ru.json")),
];

static DICTIONARIES: OnceLock<HashMap<String, Vec<DictCategory>>> = OnceLock::new();

pub fn dictionary(lang: &str) -> &'static [DictCategory] {
    let dicts = DICTIONARIES.get_or_init(|| {
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
    });
    dicts
        .get(normalize_lang(lang))
        .map(|v| v.as_slice())
        .unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalog::languages;

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
