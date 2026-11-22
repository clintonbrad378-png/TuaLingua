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
  SrsCard,
  Unit,
  VocabWord,
} from "./types";
import { api, buildFlashExercises, buildReview, poolOf } from "./api";
import { DEFAULT_LANG, langOf } from "./lib/langs";
import { markActivated, setVoiceLanguage, warmUpVoices } from "./lib/audio";
import { t as tr, useUiLang } from "./i18n";
import { open as fileOpen, save as fileSave } from "@tauri-apps/plugin-dialog";
import Home from "./screens/Home";
import Player from "./screens/Player";
import Summary from "./screens/Summary";
import Dictionary from "./screens/Dictionary";
import Flashcards from "./screens/Flashcards";
import StatsSheet from "./components/StatsSheet";
import Welcome from "./components/Welcome";
import BrandMark from "./components/BrandMark";
import ErrorBoundary from "./components/ErrorBoundary";
import { IconAlert, IconX } from "./components/icons";

type Screen =
  | { name: "home" }
  | { name: "lesson"; unit: Unit; lesson: Lesson; session: number }
  | { name: "review"; exercises: Exercise[]; session: number }
  | { name: "dictionary" }
  | { name: "flashcards" }
  | { name: "flash-quiz"; exercises: Exercise[]; session: number }
  | { name: "summary"; summary: SessionSummary; mode: "lesson" | "review" | "flash"; lesson?: Lesson; exercises?: Exercise[] };

const JSON_FILTER = { name: "TuaLingua · JSON", extensions: ["json"] };

export default function App() {
  useUiLang();
  const [langs, setLangs] = useState<LanguageInfo[]>([]);
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [dict, setDict] = useState<DictCategory[] | null>(null);
  const [deck, setDeck] = useState<Phrase[]>([]);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [statsOpen, setStatsOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [dueSoon, setDueSoon] = useState<SrsCard[] | null>(null);
  const [lang, setLang] = useState(DEFAULT_LANG);
  const [switching, setSwitching] = useState<string | null>(null);

  // Bienvenida: solo en primer uso (nunca se repite).
  useEffect(() => {
    if (!progress) return;
    if (progress.total_answers > 0) return;
    if (localStorage.getItem("tl-welcome")) return;
    localStorage.setItem("tl-welcome", "1");
    setWelcomeOpen(true);
  }, [progress]);

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
    const warm = () => {
      markActivated();
      warmUpVoices();
    };
    window.addEventListener("pointerdown", warm);
    const unlock = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") warm();
    };
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", warm);
      window.removeEventListener("keydown", unlock);
    };
  }, [load]);

  useEffect(() => {
    setVoiceLanguage(lang);
  }, [lang]);

  async function refreshProgress() {
    try {
      const p = await api.progress();
      setProgress(p);
      setLang(p.lang);
    } catch (e) {
      setError(String(e));
    }
  }

  function handleStats() {
    setStatsOpen(true);
    setDueSoon(null);
    api
      .review(6)
      .then(setDueSoon)
      .catch(() => setDueSoon([]));
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

  /** Pool para generar ejercicios: diccionario con ejemplos + frases de las
   * unidades, sin duplicados por texto del idioma destino. */
  const flashPool = useMemo(() => {
    if (!units || !dict) return [];
    const merged: VocabWord[] = [];
    const seen = new Set<string>();
    for (const category of dict) {
      for (const w of category.words) {
        const key = w.t.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ es: w.es, t: w.t, ex: w.ex });
      }
    }
    for (const p of poolOf(units)) {
      const key = p.t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ es: p.es, t: p.t });
    }
    return merged;
  }, [units, dict]);

  function toggleDeckCard(card: Phrase) {
    const key = (p: Phrase) => `${p.es.toLowerCase()}|${p.t.toLowerCase()}`;
    let rollback: Phrase[] = [];
    setDeck((prev) => {
      rollback = prev;
      const idx = prev.findIndex((p) => key(p) === key(card));
      const d = [...prev];
      if (idx >= 0) d.splice(idx, 1);
      else d.push(card);
      return d;
    });
    api
      .toggleDeck(card)
      .then((persist) => setDeck(persist))
      .catch(() => setDeck(rollback));
    void refreshProgress();
  }

  function startFlashQuiz(words: VocabWord[]) {
    if (words.length < 2 || !flashPool.length) return;
    const exercises = buildFlashExercises(words, flashPool, lang);
    setScreen({ name: "flash-quiz", exercises, session: Date.now() });
  }

  function addAllToDeck(words: Phrase[]) {
    if (!words.length) return;
    const key = (p: Phrase) => `${p.es.toLowerCase()}|${p.t.toLowerCase()}`;
    let rollback: Phrase[] = [];
    setDeck((prev) => {
      rollback = prev;
      const seen = new Set(prev.map(key));
      const d = [...prev];
      for (const w of words) {
        const k = key(w);
        if (seen.has(k)) continue;
        seen.add(k);
        d.push(w);
      }
      return d;
    });
    api
      .addDeckMany(words)
      .then((persist) => setDeck(persist))
      .catch(() => setDeck(rollback));
    void refreshProgress();
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
    try {
      const p = await api.reset();
      setProgress(p);
      setLang(langOf(p.lang).id);
      setScreen({ name: "home" });
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleExport(): Promise<boolean> {
    if (!progress) return false;
    const target = await fileSave({
      title: tr("st.export"),
      defaultPath: "progreso.json",
      filters: [JSON_FILTER],
    });
    if (!target) return false;
    const json = await api.exportJson();
    await api.saveExport(target, json);
    setError(null);
    return true;
  }

  async function handleImport(): Promise<boolean> {
    const picked = await fileOpen({
      title: tr("st.import"),
      multiple: false,
      filters: [JSON_FILTER],
    });
    if (!picked || Array.isArray(picked)) return false;
    const p = await api.importFrom(picked);
    setScreen({ name: "home" });
    setSwitching(null);
    setProgress(p);
    setLang(langOf(p.lang).id);
    await load();
    setError(null);
    return true;
  }

  if (error && !units) {
    return (
      <div className="app">
        <div className="screen splash splash-error">
          <BrandMark size={84} />
          <p className="tag">{tr("app.something_went_wrong")}</p>
          <p className="error-text">{error}</p>
          <button className="btn btn-primary" onClick={() => void load()}>
            {tr("app.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!units || !progress || !langs.length) {
    return (
      <div className="app">
        <div className="screen splash splash-intro" aria-label="TuaLingua">
          <img src="/intro.gif" alt="" className="splash-gif" draggable={false} />
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="app">
        {error && (
          <div className="error-banner" role="alert">
            <span className="banner-msg"><IconAlert size={16}/> {error}</span>
            <button
              className="btn banner-btn"
              onClick={() => void load()}
              aria-label={tr("app.retry")}
            >
              {tr("app.retry")}
            </button>
            <button className="icon-btn" onClick={() => setError(null)} aria-label={tr("app.close")}>
              <IconX size={16}/>
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
            onStats={handleStats}
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
            categories={dict}
            deck={deck}
            onBack={() => {
              void refreshProgress();
              setScreen({ name: "home" });
            }}
            onToggle={toggleDeckCard}
            onClear={() => {
              let rollback: Phrase[] = [];
              setDeck((prev) => {
                rollback = prev;
                return [];
              });
              api
                .clearDeck()
                .then((persist) => setDeck(persist))
                .catch(() => setDeck(rollback));
              void refreshProgress();
            }}
            onAddAll={addAllToDeck}
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
            intro={{
              title: screen.lesson.title,
              goal: screen.lesson.goal,
              tip: screen.lesson.tip,
              phrases: screen.lesson.phrases,
            }}
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

        {welcomeOpen && <Welcome onClose={() => setWelcomeOpen(false)} />}

        {statsOpen && progress && (
          <StatsSheet
            units={units}
            progress={progress}
            dueSoon={dueSoon}
            onClose={() => {
              setStatsOpen(false);
              void refreshProgress();
            }}
            onReset={handleReset}
            onDailyGoal={(goal) =>
              api
                .setDailyGoal(goal)
                .then((p) => {
                  setProgress(p);
                  return true;
                })
                .catch((e) => {
                  setError(String(e));
                  return false;
                })
            }
            onExport={() =>
              handleExport().catch((e) => {
                setError(String(e));
                return false;
              })
            }
            onImport={() =>
              handleImport().catch((e) => {
                setError(String(e));
                return false;
              })
            }
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
