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
  VocabWord,
} from "./types";
import { normalize, shuffleRandom } from "./lib/text";
import * as i18n from "./i18n";

export const api = {
  languages: () => invoke<LanguageInfo[]>("get_languages"),
  catalog: () => invoke<Unit[]>("get_catalog"),
  dictionary: () => invoke<DictCategory[]>("get_dictionary"),
  setLanguage: (lang: string) =>
    invoke<ProgressState>("set_language", { lang }).then((p) => {
      if (p.lang !== lang) {
        throw new Error(`idioma no soportado: ${lang}`);
      }
      return p;
    }),
  deck: () => invoke<Phrase[]>("get_deck"),
  toggleDeck: (card: Phrase) =>
    invoke<Phrase[]>("toggle_deck_card", { es: card.es, t: card.t }),
  addDeckMany: (cards: Phrase[]) =>
    invoke<Phrase[]>(
      "add_deck_many",
      { cards: cards.map((c) => ({ es: c.es, t: c.t })) },
    ),
  clearDeck: () => invoke<Phrase[]>("clear_deck"),
  progress: () => invoke<ProgressState>("get_progress"),
  setDailyGoal: (goal: number) =>
    invoke<ProgressState>("set_daily_goal", { goal }),
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
  exportJson: () => invoke<string>("export_progress"),
  saveExport: (path: string, json: string) =>
    invoke<void>("save_export", { path, json }),
  importFrom: (path: string) => invoke<ProgressState>("import_progress", { path }),
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

/** Frases para opciones erróneas (texto del idioma objetivo). */
function targetDistractors(target: string, pool: Phrase[]): string[] {
  return shuffleRandom(
    pool.filter((p) => p.t.toLowerCase() !== target.toLowerCase()).map((p) => p.t),
  ).slice(0, 3);
}

function esDistractors(es: string, pool: Phrase[]): string[] {
  return shuffleRandom(
    pool.filter((p) => p.es.toLowerCase() !== es.toLowerCase()).map((p) => p.es),
  ).slice(0, 3);
}

/** Palabras que no aportan para localizar un vocablo dentro de un ejemplo. */
const SKIP_TOKENS = new Set(["the", "a", "an", "to", "de", "del", "la", "el"]);

/** Parte significativa de la palabra objetivo (sin artículo inicial). */
function headToken(w: string): string {
  const parts = w
    .trim()
    .split(/\s+/)
    .filter((p) => !SKIP_TOKENS.has(p.toLowerCase()));
  return (parts[parts.length - 1] ?? w).toLowerCase();
}

/** Ejercicio de hueco a partir del ejemplo: `The ___ is my best friend`. */
export function fillFromExample(
  word: VocabWord,
  pool: Phrase[],
  id: string,
): Exercise | null {
  if (!word.ex) return null;
  const head = normalize(headToken(word.t));
  if (!head) return null;
  const tokens = word.ex.t.split(/\s+/);
  const idx = tokens.findIndex((tk) => normalize(tk) === head);
  if (idx < 0) return null;
  const seen = new Set([normalize(head)]);
  const wrong = shuffleRandom(
    pool.filter((p) => p.t.toLowerCase() !== word.t.toLowerCase()),
  )
    .map((p) => normalize(headToken(p.t)))
    .filter((h) => {
      if (!h || seen.has(h)) return false;
      seen.add(h);
      return true;
    })
    .slice(0, 3);
  if (wrong.length < 3) return null;
  const answer = tokens[idx].replace(/[.,!?;:«»"“”'’]+$/, "");
  const sentence = tokens
    .map((tk, i) => (i === idx ? "___" : tk))
    .join(" ")
    .replace(/\s+([,.!?;:])/g, "$1");
  const options = shuffleRandom([answer, ...wrong]);
  return {
    id,
    type: "fill",
    prompt: i18n.t("q.fill_intro"),
    sentence,
    options,
    answer: options.indexOf(answer),
    pair: { es: word.es, t: word.t },
  };
}

export function buildFlashExercises(
  words: VocabWord[],
  pool: Phrase[],
  lang: string,
): Exercise[] {
  const label = i18n.targetLangName(lang);
  const cards = shuffleRandom(words).slice(0, FLASH_BATCH);
  const exercises: Exercise[] = cards.map((card, i) => {
    const es = card.es;
    const target = card.t;
    const id = `fc-${i}`;
    const mode = i % 4;
    if (mode === 0 || mode === 3) {
      const fill = mode === 3 ? fillFromExample(card, pool, id) : null;
      if (fill) return fill;
      const wrong = targetDistractors(target, pool);
      const options = shuffleRandom([target, ...wrong]);
      return {
        id,
        type: "choice",
        prompt: i18n.t("q.choice", { es }),
        options,
        answer: options.indexOf(target),
        pair: { es, t: target },
      };
    }
    if (mode === 1) {
      return {
        id,
        type: "type",
        prompt: i18n.t("q.type_intro", { lang: label, es }),
        solution: target,
        accept: [target],
        pair: { es, t: target },
      };
    }
    const wrong = esDistractors(es, pool);
    const options = shuffleRandom([es, ...wrong]);
    return {
      id,
      type: "listen",
      prompt: i18n.t("q.listen_intro"),
      audio: target,
      options,
      answer: options.indexOf(es),
      pair: { es, t: target },
    };
  });
  if (cards.length >= 2) {
    exercises.push({
      id: "fc-match",
      type: "match",
      prompt: i18n.t("q.match_intro"),
      pairs: cards.slice(0, 5).map(({ es, t }) => ({ es, t })),
    });
  }
  return exercises;
}

export function buildReview(
  cards: SrsCard[],
  pool: Phrase[],
  lang: string,
): Exercise[] {
  const label = i18n.targetLangName(lang);
  const exercises: Exercise[] = [];
  const canonEs = (c: SrsCard) =>
    pool.find((p) => p.es.toLowerCase() === c.es.toLowerCase())?.es ?? c.es;
  const canonT = (c: SrsCard) =>
    pool.find((p) => p.t.toLowerCase() === c.t.toLowerCase())?.t ?? c.t;
  cards.forEach((card, i) => {
    const es = canonEs(card);
    const target = canonT(card);
    const mode = i % 3;
    if (mode === 0) {
      const wrong = shuffleRandom(
        pool.filter((p) => p.t.toLowerCase() !== target.toLowerCase()).map((p) => p.t),
      ).slice(0, 3);
      const options = shuffleRandom([target, ...wrong]);
      exercises.push({
        id: `rev-${i}`,
        type: "choice",
        prompt: i18n.t("q.choice", { es }),
        options,
        answer: options.indexOf(target),
        pair: { es, t: target },
      });
    } else if (mode === 1) {
      exercises.push({
        id: `rev-${i}`,
        type: "type",
        prompt: i18n.t("q.type_intro", { lang: label, es }),
        solution: target,
        accept: [target],
        pair: { es, t: target },
      });
    } else {
      const wrong = shuffleRandom(
        pool.filter((p) => p.es.toLowerCase() !== es.toLowerCase()).map((p) => p.es),
      ).slice(0, 3);
      const options = shuffleRandom([es, ...wrong]);
      exercises.push({
        id: `rev-${i}`,
        type: "listen",
        prompt: i18n.t("q.listen_intro"),
        audio: target,
        options,
        answer: options.indexOf(es),
        pair: { es, t: target },
      });
    }
  });
  return exercises;
}
