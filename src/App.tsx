import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DictCategory,
  Exercise,
  LanguageInfo,
  Lesson,
  Phrase,
  ProgressState,
  RoundResult,
  SessionSummary,
  Unit,
} from "./types";
import { api, buildFlashExercises, buildReview, poolOf } from "./api";
import { DEFAULT_LANG, langOf } from "./lib/langs";
import { markActivated, setVoiceLanguage, warmUpVoices } from "./lib/audio";
import Home from "./screens/Home";
import Player from "./screens/Player";
import Summary from "./screens/Summary";
import Dictionary from "./screens/Dictionary";
import Flashcards from "./screens/Flashcards";
import StatsSheet from "./components/StatsSheet";
import Mascot from "./components/Mascot";

type Screen =
  | { name: "home" }
  | { name: "lesson"; unit: Unit; lesson: Lesson; session: number }
  | { name: "review"; exercises: Exercise[]; session: number }
  | { name: "dictionary" }
  | { name: "flashcards" }
  | { name: "flash-quiz"; exercises: Exercise[]; session: number }
  | { name: "summary"; summary: SessionSummary; mode: "lesson" | "review" | "flash"; lesson?: Lesson; exercises?: Exercise[] };

export default function App() {
  const [langs, setLangs] = useState<LanguageInfo[]>([]);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [dict, setDict] = useState<DictCategory[] | null>(null);
  const [deck, setDeck] = useState<Phrase[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [statsOpen, setStatsOpen] = useState(false);
  const [lang, setLang] = useState(DEFAULT_LANG);
  const [switching, setSwitching] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [languages, p, u, d, dk] = await Promise.all([
        api.languages(),
        api.progress(),
        api.catalog(),
        api.dictionary(),
        api.deck(),
      ]);
      setLangs(languages);
      setProgress(p);
      setUnits(u);
      setDict(d);
      setDeck(dk);
      setLang(langOf(p.lang).id);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setVoiceLanguage(lang);
  }, [lang]);

  useEffect(() => {
    const warm = () => {
      markActivated();
      warmUpVoices();
    };
    window.addEventListener("pointerdown", warm);
    return () => window.removeEventListener("pointerdown", warm);
  }, []);

  async function refreshProgress() {
    const p = await api.progress();
    setProgress(p);
    setLang(p.lang);
  }

  async function handleSwitchLanguage() {
    if (!switching) return;
    const id = switching;
    try {
      const p = await api.setLanguage(id);
      setProgress(p);
      setLang(langOf(p.lang).id);
      setSwitching(null);
      setScreen({ name: "home" });
      await load();
    } catch (e) {
      setError(String(e));
      setSwitching(null);
    }
  }

  async function handleLessonFinish(
    lesson: Lesson,
    correct: number,
    total: number,
    comboMax: number,
    rounds: RoundResult[],
  ) {
    try {
      const summary = await api.completeLesson(lesson.id, correct, total, comboMax, rounds);
      await refreshProgress();
      setScreen({ name: "summary", summary, mode: "lesson", lesson });
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleReviewFinish(
    correct: number,
    total: number,
    comboMax: number,
    rounds: RoundResult[],
  ) {
    try {
      const summary = await api.submitReview(correct, total, comboMax, rounds);
      await refreshProgress();
      setScreen({ name: "summary", summary, mode: "review" });
    } catch (e) {
      setError(String(e));
    }
  }

  async function startReview() {
    if (!units) return;
    try {
      const cards = await api.review(12);
      if (!cards.length) return;
      const exercises = buildReview(cards, poolOf(units), lang);
      setScreen({ name: "review", exercises, session: Date.now() });
    } catch (e) {
      setError(String(e));
    }
  }

  const flashPool = useMemo(() => {
    if (!units || !dict) return [];
    const base = poolOf(units);
    const seen = new Set(base.map((p) => p.t.toLowerCase()));
    const merged = [...base];
    for (const category of dict) {
      for (const w of category.words) {
        if (!seen.has(w.t.toLowerCase())) {
          seen.add(w.t.toLowerCase());
          merged.push({ es: w.es, t: w.t });
        }
      }
    }
    return merged;
  }, [units, dict]);

  function toggleDeckCard(card: Phrase) {
    const key = (p: Phrase) => `${p.es.toLowerCase()}|${p.t.toLowerCase()}`;
    const idx = deck.findIndex((p) => key(p) === key(card));
    const d = [...deck];
    if (idx >= 0) d.splice(idx, 1);
    else d.push(card);
    setDeck(d);
    api
      .toggleDeck(card)
      .then((persist) => setDeck(persist))
      .catch(() => setDeck(deck));
    void refreshProgress();
  }

  function startFlashQuiz() {
    if (deck.length < 2 || !flashPool.length) return;
    const exercises = buildFlashExercises(deck, flashPool, lang);
    setScreen({ name: "flash-quiz", exercises, session: Date.now() });
  }

  async function handleFlashQuizFinish(
    exercises: Exercise[],
    correct: number,
    total: number,
    comboMax: number,
    rounds: RoundResult[],
  ) {
    try {
      const summary = await api.submitReview(correct, total, comboMax, rounds);
      await refreshProgress();
      setScreen({
        name: "summary",
        summary,
        mode: "flash",
        exercises,
      });
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleReset() {
    const p = await api.reset();
    setProgress(p);
    setLang(langOf(p.lang).id);
    setScreen({ name: "home" });
  }

  if (error && !units) {
    return (
      <div className="app">
        <div className="screen splash">
          <Mascot mood="sad" size={110} />
          <p className="tag">Algo ha ido mal</p>
          <p className="error-text">{error}</p>
          <button className="btn btn-primary" onClick={() => void load()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!units || !progress || !langs.length) {
    return (
      <div className="app">
        <div className="screen splash">
          <Mascot mood="idle" size={120} />
          <h1 className="brand">
            Tua<span>Lingua</span>
          </h1>
          <p className="tag">Aprende idiomas, directo al grano</p>
          <div className="dots">
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {error && (
        <div className="error-banner" role="alert">
          <span>⚠️ {error}</span>
          <button
            className="btn banner-btn"
            onClick={() => void load()}
            aria-label="Reintentar"
          >
            Reintentar
          </button>
          <button className="icon-btn" onClick={() => setError(null)} aria-label="Cerrar">
            ✕
          </button>
        </div>
      )}
      {screen.name === "home" && (
        <Home
          langs={langs}
          lang={lang}
          switching={switching}
          onSwitchPick={(id) => setSwitching(id === lang ? null : id)}
          onSwitchConfirm={() => void handleSwitchLanguage()}
          onSwitchCancel={() => setSwitching(null)}
          units={units}
          progress={progress}
          onStart={(unit, lesson) =>
            setScreen({ name: "lesson", unit, lesson, session: Date.now() })
          }
          onReview={() => void startReview()}
          onStats={() => setStatsOpen(true)}
          onDictionary={() => setScreen({ name: "dictionary" })}
          onFlashcards={() => setScreen({ name: "flashcards" })}
        />
      )}

      {screen.name === "dictionary" && dict && (
        <Dictionary
          lang={lang}
          categories={dict}
          deck={deck}
          onBack={() => {
            void refreshProgress();
            setScreen({ name: "home" });
          }}
          onToggle={toggleDeckCard}
          onSeeDeck={() => setScreen({ name: "flashcards" })}
        />
      )}

      {screen.name === "flashcards" && dict && (
        <Flashcards
          dictCategories={dict}
          deck={deck}
          onBack={() => {
            void refreshProgress();
            setScreen({ name: "home" });
          }}
          onRemove={toggleDeckCard}
          onClear={() => {
            const d = [...deck];
            setDeck([]);
            api
              .clearDeck()
              .then((persist) => setDeck(persist))
              .catch(() => setDeck(d));
            void refreshProgress();
          }}
          onOpenDictionary={() => setScreen({ name: "dictionary" })}
          onStartQuiz={startFlashQuiz}
        />
      )}

      {screen.name === "flash-quiz" && (
        <Player
          key={screen.session}
          mode="flash"
          lang={lang}
          exercises={screen.exercises}
          onExit={() => {
            void refreshProgress();
            setScreen({ name: "home" });
          }}
          onFinish={(c, t, m, r) => void handleFlashQuizFinish(screen.exercises, c, t, m, r)}
        />
      )}

      {screen.name === "lesson" && (
        <Player
          key={screen.session}
          mode="lesson"
          lang={lang}
          exercises={screen.lesson.exercises}
          onExit={() => setScreen({ name: "home" })}
          onFinish={(c, t, m, r) => void handleLessonFinish(screen.lesson, c, t, m, r)}
        />
      )}

      {screen.name === "review" && (
        <Player
          key={screen.session}
          mode="review"
          lang={lang}
          exercises={screen.exercises}
          onExit={() => setScreen({ name: "home" })}
          onFinish={(c, t, m, r) => void handleReviewFinish(c, t, m, r)}
        />
      )}

      {screen.name === "summary" && (
        <Summary
          summary={screen.summary}
          mode={screen.mode}
          lessonTitle={screen.lesson?.title}
          onContinue={() => {
            void refreshProgress();
            setScreen({ name: "home" });
          }}
          onRetry={
            screen.lesson
              ? () =>
                  setScreen({
                    name: "lesson",
                    unit: units.find((u) => u.lessons.some((l) => l.id === screen.lesson!.id))!,
                    lesson: screen.lesson!,
                    session: Date.now(),
                  })
              : screen.exercises && dict
                ? () =>
                    setScreen({
                      name: "flash-quiz",
                      exercises: buildFlashExercises(
                        screen.exercises!.flatMap((ex) =>
                          ex.pair ? [{ es: ex.pair.es, t: ex.pair.t }] : [],
                        ),
                        flashPool,
                        lang,
                      ),
                      session: Date.now(),
                    })
                : undefined
          }
        />
      )}

      {statsOpen && (
        <StatsSheet
          units={units}
          progress={progress}
          onClose={() => setStatsOpen(false)}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
