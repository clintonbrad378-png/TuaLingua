use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Serialize, Deserialize, Clone)]
pub struct Phrase {
    pub es: String,
    pub en: String,
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

const SOURCES: [&str; 4] = [
    include_str!("content/u1.json"),
    include_str!("content/u2.json"),
    include_str!("content/u3.json"),
    include_str!("content/u4.json"),
];

static CATALOG: OnceLock<Vec<Unit>> = OnceLock::new();

pub fn catalog() -> &'static Vec<Unit> {
    CATALOG.get_or_init(|| {
        SOURCES
            .iter()
            .map(|s| serde_json::from_str::<Unit>(s).expect("contenido JSON inválido"))
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_is_valid() {
        let units = catalog();
        assert_eq!(units.len(), 4);
        let mut ids = std::collections::HashSet::new();
        let mut exercises = 0usize;
        for unit in units {
            assert!(!unit.lessons.is_empty());
            for lesson in &unit.lessons {
                assert!(ids.insert(lesson.id.clone()), "lección duplicada {}", lesson.id);
                assert!(!lesson.phrases.is_empty());
                assert!(lesson.exercises.len() >= 6);
                for ex in &lesson.exercises {
                    assert!(ids.insert(ex.id.clone()), "ejercicio duplicado {}", ex.id);
                    exercises += 1;
                    match &ex.kind {
                        ExerciseKind::Choice { options, answer } | ExerciseKind::Listen { options, answer, .. } | ExerciseKind::Fill { options, answer, .. } => {
                            assert!(*answer < options.len());
                            assert!(options.len() >= 2);
                        }
                        ExerciseKind::Build { solution, .. } => assert!(!solution.is_empty()),
                        ExerciseKind::Type { solution, .. } => assert!(!solution.is_empty()),
                        ExerciseKind::Match { pairs } => assert!(pairs.len() >= 3),
                    }
                }
            }
        }
        assert!(exercises >= 100, "se esperaban al menos 100 ejercicios, hay {exercises}");
    }
}
