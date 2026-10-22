import { invoke } from "@tauri-apps/api/core";
import type {
  Exercise,
  Phrase,
  ProgressState,
  RoundResult,
  SessionSummary,
  SrsCard,
  Unit,
} from "./types";

export const api = {
  catalog: () => invoke<Unit[]>("get_catalog"),
  progress: () => invoke<ProgressState>("get_progress"),
  completeLesson: (
    lessonId: string,
    correct: number,
    total: number,
    comboMax: number,
    rounds: RoundResult[],
  ) =>
    invoke<SessionSummary>("complete_lesson", {
      lessonId,
      correct,
      total,
      comboMax,
      rounds,
    }),
  submitReview: (
    correct: number,
    total: number,
    comboMax: number,
    rounds: RoundResult[],
  ) =>
    invoke<SessionSummary>("submit_review", {
      correct,
      total,
      comboMax,
      rounds,
    }),
  review: (limit = 12) => invoke<SrsCard[]>("get_review", { limit }),
  reset: () => invoke<ProgressState>("reset_progress"),
};

export function poolOf(units: Unit[]): Phrase[] {
  const pool: Phrase[] = [];
  const seen = new Set<string>();
  const push = (p: Phrase) => {
    const key = p.en.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    pool.push(p);
  };
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      lesson.phrases.forEach(push);
      for (const ex of lesson.exercises) {
        if (ex.pair) push(ex.pair);
        if (ex.type === "match") ex.pairs.forEach(push);
      }
    }
  }
  return pool;
}

export function buildReview(cards: SrsCard[], pool: Phrase[]): Exercise[] {
  const rnd = () => Math.random();
  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const exercises: Exercise[] = [];
  const canonEs = (c: SrsCard) =>
    pool.find((p) => p.es.toLowerCase() === c.es.toLowerCase())?.es ?? c.es;
  const canonEn = (c: SrsCard) =>
    pool.find((p) => p.en.toLowerCase() === c.en.toLowerCase())?.en ?? c.en;
  cards.forEach((card, i) => {
    const es = canonEs(card);
    const en = canonEn(card);
    const mode = i % 3;
    if (mode === 0) {
      const wrong = shuffle(
        pool.filter((p) => p.en.toLowerCase() !== en.toLowerCase()).map((p) => p.en),
      ).slice(0, 3);
      const options = shuffle([en, ...wrong]);
      exercises.push({
        id: `rev-${i}`,
        type: "choice",
        prompt: `¿Cómo se dice «${es}»?`,
        options,
        answer: options.indexOf(en),
        pair: { es, en },
      });
    } else if (mode === 1) {
      exercises.push({
        id: `rev-${i}`,
        type: "type",
        prompt: `Escribe en inglés: «${es}»`,
        solution: en,
        accept: [en],
        pair: { es, en },
      });
    } else {
      const wrong = shuffle(
        pool.filter((p) => p.es.toLowerCase() !== es.toLowerCase()).map((p) => p.es),
      ).slice(0, 3);
      const options = shuffle([es, ...wrong]);
      exercises.push({
        id: `rev-${i}`,
        type: "listen",
        prompt: "Escucha y elige la traducción",
        audio: en,
        options,
        answer: options.indexOf(es),
        pair: { es, en },
      });
    }
  });
  return exercises;
}
