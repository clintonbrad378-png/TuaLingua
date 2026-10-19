export type Phrase = { es: string; en: string };

type Base = {
  id: string;
  prompt: string;
  pair?: Phrase;
  explain?: string;
};

export type Exercise =
  | (Base & { type: "choice"; options: string[]; answer: number })
  | (Base & { type: "listen"; audio: string; options: string[]; answer: number })
  | (Base & { type: "build"; solution: string; distractors: string[] })
  | (Base & { type: "match"; pairs: Phrase[] })
  | (Base & { type: "type"; solution: string; accept: string[] })
  | (Base & { type: "fill"; sentence: string; options: string[]; answer: number });

export type Lesson = {
  id: string;
  title: string;
  goal: string;
  tip: string[];
  phrases: Phrase[];
  exercises: Exercise[];
};

export type Unit = {
  id: string;
  title: string;
  emoji: string;
  color: string;
  lessons: Lesson[];
};

export type LessonProgress = {
  best_accuracy: number;
  stars: number;
  times: number;
};

export type ProgressState = {
  xp: number;
  level: number;
  level_title: string;
  level_xp: number;
  level_needed: number;
  streak: number;
  best_streak: number;
  active_today: boolean;
  xp_today: number;
  daily_goal: number;
  total_correct: number;
  total_answers: number;
  words_learned: number;
  due_count: number;
  lessons: Record<string, LessonProgress>;
};

export type SessionSummary = {
  xp_gained: number;
  total_xp: number;
  streak: number;
  streak_up: boolean;
  best_streak: number;
  level: number;
  level_title: string;
  level_up: boolean;
  level_xp: number;
  level_needed: number;
  accuracy: number;
  correct: number;
  total: number;
  combo_max: number;
  stars: number;
  new_words: Phrase[];
  due_count: number;
  words_learned: number;
};

export type SrsCard = {
  es: string;
  en: string;
  due: string;
  reps: number;
};

export type RoundResult = {
  es: string;
  en: string;
  correct: boolean;
};
