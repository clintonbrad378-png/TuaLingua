import { useCallback, useEffect, useState } from "react";
import type {
  Exercise,
  Lesson,
  ProgressState,
  RoundResult,
  SessionSummary,
  Unit,
} from "./types";
import { api, buildReview, poolOf } from "./api";
import { warmUpVoices } from "./lib/audio";
import Home from "./screens/Home";
import Player from "./screens/Player";
import Summary from "./screens/Summary";
import StatsSheet from "./components/StatsSheet";
import Mascot from "./components/Mascot";

type Screen =
  | { name: "home" }
  | { name: "lesson"; unit: Unit; lesson: Lesson; session: number }
  | { name: "review"; exercises: Exercise[]; session: number }
  | { name: "summary"; summary: SessionSummary; mode: "lesson" | "review"; lesson?: Lesson };

export default function App() {
  const [units, setUnits] = useState<Unit[] | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [statsOpen, setStatsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([api.catalog(), api.progress()]);
      setUnits(u);
      setProgress(p);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const warm = () => warmUpVoices();
    window.addEventListener("pointerdown", warm, { once: true });
    return () => window.removeEventListener("pointerdown", warm);
  }, []);

  async function refreshProgress() {
    const p = await api.progress();
    setProgress(p);
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
      const exercises = buildReview(cards, poolOf(units));
      setScreen({ name: "review", exercises, session: Date.now() });
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleReset() {
    const p = await api.reset();
    setProgress(p);
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

  if (!units || !progress) {
    return (
      <div className="app">
        <div className="screen splash">
          <Mascot mood="idle" size={120} />
          <h1 className="brand">
            Tua<span>Lingua</span>
          </h1>
          <p className="tag">Tu inglés, directo al grano</p>
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
      {screen.name === "home" && (
        <Home
          units={units}
          progress={progress}
          onStart={(unit, lesson) =>
            setScreen({ name: "lesson", unit, lesson, session: Date.now() })
          }
          onReview={() => void startReview()}
          onStats={() => setStatsOpen(true)}
        />
      )}

      {screen.name === "lesson" && (
        <Player
          key={screen.session}
          mode="lesson"
          exercises={screen.lesson.exercises}
          onExit={() => setScreen({ name: "home" })}
          onFinish={(c, t, m, r) => void handleLessonFinish(screen.lesson, c, t, m, r)}
        />
      )}

      {screen.name === "review" && (
        <Player
          key={screen.session}
          mode="review"
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
          onContinue={() => setScreen({ name: "home" })}
          onRetry={
            screen.lesson
              ? () =>
                  setScreen({
                    name: "lesson",
                    unit: units.find((u) => u.lessons.some((l) => l.id === screen.lesson!.id))!,
                    lesson: screen.lesson!,
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
