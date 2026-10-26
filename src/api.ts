import { invoke } from "@tauri-apps/api/core";
import type {
  DictCategory,
  Exercise,
  LanguageInfo,
  Phrase,
  ProgressState,
  RoundResult,
  SessionSummary,
  SrsCard,
  Unit,
} from "./types";
import { langOf, langTitle } from "./lib/langs";

export const api = {
  languages: () => invoke<LanguageInfo[]>("get_languages"),
  catalog: () => invoke<Unit[]>("get_catalog"),
  dictionary: () => invoke<DictCategory[]>("get_dictionary"),
  setLanguage: (lang: string) =>
    invoke<ProgressState>("set_language", { lang }).then((p) => {
      if (p.lang !== langOf(lang).id) {
        throw new Error(`idioma no soportado: ${lang}`);
      }
      return p;
    }),
  deck: () => invoke<Phrase[]>("get_deck"),
  toggleDeck: (card: Phrase) =>
    invoke<Phrase[]>("toggle_deck_card", { es: card.es, t: card.t }),
  clearDeck: () => invoke<Phrase[]>("clear_deck"),
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
    const key = p.t.toLowerCase();
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

export const FLASH_BATCH = 12;

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildFlashExercises(
  words: Phrase[],
  pool: Phrase[],
  lang: string,
): Exercise[] {
  const label = langTitle(lang);
  const cards = shuffleArr(words).slice(0, FLASH_BATCH);
  const exercises: Exercise[] = cards.map((card, i) => {
    const es = card.es;
    const t = card.t;
    const mode = i % 3;
    if (mode === 0) {
      const wrong = shuffleArr(
        pool.filter((p) => p.t.toLowerCase() !== t.toLowerCase()).map((p) => p.t),
      ).slice(0, 3);
      const options = shuffleArr([t, ...wrong]);
      return {
        id: `fc-${i}`,
        type: "choice",
        prompt: `¿Cómo se dice «${es}»?`,
        options,
        answer: options.indexOf(t),
        pair: { es, t },
      };
    }
    if (mode === 1) {
      return {
        id: `fc-${i}`,
        type: "type",
        prompt: `Escribe en ${label}: «${es}»`,
        solution: t,
        accept: [t],
        pair: { es, t },
      };
    }
    const wrong = shuffleArr(
      pool.filter((p) => p.es.toLowerCase() !== es.toLowerCase()).map((p) => p.es),
    ).slice(0, 3);
    const options = shuffleArr([es, ...wrong]);
    return {
      id: `fc-${i}`,
      type: "listen",
      prompt: "Escucha y elige la traducción",
      audio: t,
      options,
      answer: options.indexOf(es),
      pair: { es, t },
    };
  });
  return exercises;
}

export function buildReview(
  cards: SrsCard[],
  pool: Phrase[],
  lang: string,
): Exercise[] {
  const label = langTitle(lang);
  const rnd = () => Math.random();
  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = 0; i < a.length; i++) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const exercises: Exercise[] = [];
  const canonEs = (c: SrsCard) =>
    pool.find((p) => p.es.toLowerCase() === c.es.toLowerCase())?.es ?? c.es;
  const canonT = (c: SrsCard) =>
    pool.find((p) => p.t.toLowerCase() === c.t.toLowerCase())?.t ?? c.t;
  cards.forEach((card, i) => {
    const es = canonEs(card);
    const t = canonT(card);
    const mode = i % 3;
    if (mode === 0) {
      const wrong = shuffle(
        pool.filter((p) => p.t.toLowerCase() !== t.toLowerCase()).map((p) => p.t),
      ).slice(0, 3);
      const options = shuffle([t, ...wrong]);
      exercises.push({
        id: `rev-${i}`,
        type: "choice",
        prompt: `¿Cómo se dice «${es}»?`,
        options,
        answer: options.indexOf(t),
        pair: { es, t },
      });
    } else if (mode === 1) {
      exercises.push({
        id: `rev-${i}`,
        type: "type",
        prompt: `Escribe en ${label}: «${es}»`,
        solution: t,
        accept: [t],
        pair: { es, t },
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
        audio: t,
        options,
        answer: options.indexOf(es),
        pair: { es, t },
      });
    }
  });
  return exercises;
}
