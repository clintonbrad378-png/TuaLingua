/** Además del idioma de estudio (en/ru), la UI tiene su propio idioma.
 *
 * - `t(key, vars)` para plantillas con `{var}`.
 * - `useUiLang()` en los componentes para re-render cuando cambia.
 * - Se guarda en localStorage y también escribe <html lang>.
 */
import { useEffect, useReducer } from "react";

export type UiLang = "es" | "en";
export const UI_LANGS: { id: UiLang; label: string }[] = [
  { id: "es", label: "Español" },
  { id: "en", label: "English" },
];

type Table = Record<string, string>;

const ES: Table = {
  // general
  "app.brand": "TuaLingua",
  "app.tagline": "Aprende idiomas, directo al grano",
  "app.retry": "Reintentar",
  "app.something_went_wrong": "Algo ha ido mal",
  "app.close": "Cerrar",

  // idiomas de estudio
  "lang.en": "Inglés",
  "lang.ru": "Ruso",

  // niveles (orden fijo, 7 títulos)
  "level.1": "Novato",
  "level.2": "Curioso",
  "level.3": "Charlatán",
  "level.4": "Viajero",
  "level.5": "Conversador",
  "level.6": "Casi bilingüe",
  "level.7": "Maestro del idioma",

  // Home
  "home.change_lang": "Cambiar idioma",
  "home.level_short": "Nv {n}",
  "home.unmute": "Activar sonidos",
  "home.mute": "Silenciar",
  "home.stats": "Estadísticas",
  "home.goal": "Meta diaria",
  "home.goal_done": "¡Meta diaria completada! 🎉",
  "home.review_title": "Repaso inteligente",
  "home.review_one": "1 palabra toca repasar",
  "home.review_many": "{n} palabras tocan repasar",
  "home.review_go": "Repasar ›",
  "home.tile_dict": "Diccionario",
  "home.tile_dict_sub": "Consulta por categorías",
  "home.tile_flash": "Flashcards",
  "home.tile_deck_empty": "Crea tu mazo",
  "home.tile_deck_one": "1 palabra en tu mazo",
  "home.tile_deck_many": "{n} palabras en tu mazo",
  "home.key_phrases": "Frases clave",
  "home.listen": "Escuchar",
  "home.start": "Empezar",
  "home.repeat": "Repetir lección",
  "home.xp_suffix": "{n}+ XP",
  "home.pick_title": "Elige un idioma",
  "home.pick_note":
    "Tu progreso se guarda por idioma; el XP y la racha son de toda la app.",
  "home.pick_level": "Nivel {level}",
  "home.back": "Volver",
  "home.switch_title": "¿Cambiar a {lang}?",
  "home.switch_note":
    "Nivel {level}. Tu XP y racha son de toda la app; el mazo y el repaso son por idioma.",
  "home.switch_go": "Cambiar a {lang}",

  // Player
  "p.exit": "Salir",
  "p.exit_title": "¿Salir de la sesión?",
  "p.exit_note": "Perderás el progreso de esta sesión.",
  "p.exit_yes": "Salir",
  "p.exit_no": "Seguir",
  "p.skip": "No lo sé",
  "p.continue": "Continuar",
  "p.check": "Comprobar",
  "p.build_hint": "Toca las palabras en orden…",
  "p.ko": "Casi…",
  "p.listen": "Escuchar",
  "p.listen_slow": "Escuchar despacio",
  "p.listen_again": "Escuchar de nuevo",
  "p.type_placeholder": "Escribe en {lang}…",
  "p.review_icon": "Repaso",
  // prompts generados
  "q.choice": "¿Cómo se dice «{es}»?",
  "q.type_intro": "Escribe en {lang}: «{es}»",
  "q.listen_intro": "Escucha y elige la traducción",

  // Summary
  "s.accuracy": "precisión",
  "s.title_lesson": "¡Lección completada!",
  "s.title_review": "¡Repaso completado!",
  "s.title_flash": "¡Práctica completada!",
  "s.correct_of": "{n} de {total} correctas",
  "s.combo": " · combo ×{n} 🔥",
  "s.level_up": "🏅 ¡Nivel {n}: {title}!",
  "s.streak_up": "🔥 Racha de {n} días",
  "s.new_words": "Palabras nuevas",
  "s.listen": "Escuchar",
  "s.foot": "⚡ {xp} XP total · 📚 {words} {s}",
  "s.word_one": "palabra",
  "s.word_many": "palabras",
  "s.save_warning": "⚠️ No se pudo guardar el progreso en el disco.",
  "s.retry": "Repetir",

  // Dictionary
  "d.title": "Diccionario",
  "d.back": "Volver",
  "d.see_deck": "Ver tu mazo",
  "d.search": "Buscar palabra",
  "d.search_ph": "Buscar palabra… ({lang} o español)",
  "d.results_one": "1 resultado",
  "d.results_many": "{n} resultados",
  "d.cat_words": "{emoji} {title} · {n} {s}",
  "d.word_one": "palabra",
  "d.word_many": "palabras",
  "d.no_results": "Sin resultados para «{q}»",
  "d.listen": "Escuchar {word}",
  "d.add": "Añadir al mazo",
  "d.remove": "Quitar del mazo",
  "pos.n": "sustantivo",
  "pos.v": "verbo",
  "pos.adj": "adjetivo",
  "pos.adv": "adverbio",
  "pos.phr": "frase",

  // Flashcards
  "f.title": "Flashcards",
  "f.empty_title": "Tu mazo está vacío",
  "f.empty_text":
    "Elige palabras en el diccionario y aparecerán aquí para estudiarlas con tarjetas y ejercicios.",
  "f.go_dict": "Ir al diccionario 📖",
  "f.study": "🃏 Estudiar tarjetas",
  "f.practice": "✍️ Practicar con ejercicios",
  "f.hint":
    "Toca las tarjetas para pasar del español al otro idioma. Practicar genera XP y refuerza tu repaso.",
  "f.deck": "Tu mazo",
  "f.listen": "Escuchar {word}",
  "f.remove": "Quitar del mazo",
  "f.clear": "Vaciar mazo",
  "f.confirm": "¿Seguro? Toca otra vez",
  "f.reveal": "Toca para ver la palabra",
  "f.listen_btn": "Escuchar",
  "f.prev": "‹ Anterior",
  "f.next": "Siguiente ›",
  "f.finish": "Terminar ›",
  "f.exit_study": "Salir del estudio",
  "f.done": "¡Mazo revisado!",
  "f.done_text": "Has repasado {n} {s}.",
  "f.card_one": "tarjeta",
  "f.card_many": "tarjetas",

  // StatsSheet
  "unit.lesson_one": "lección",
  "unit.lesson_many": "lecciones",
  "st.title": "Tu progreso",
  "st.level_short": "Nv {n}",
  "st.xp_total": "XP total",
  "st.streak": "Racha actual",
  "st.best_streak": "Mejor racha",
  "st.accuracy": "Precisión",
  "st.words": "Palabras aprendidas",
  "st.due": "Por repasar",
  "st.cards": "Tarjetas activas",
  "st.units": "Unidades",
  "st.close": "Cerrar",
  "st.reset": "Reiniciar progreso",
  "st.confirm": "¿Seguro? Toca otra vez",
  "st.settings": "Ajustes",
  "st.daily_goal": "Meta diaria",
  "st.daily_goal_hint": "XP que quieres ganar cada día",
  "st.ui_lang": "Idioma de la interfaz",
  "st.calendar": "Calendario de rachas",
  "st.calendar_hint": "Últimos 3 meses · hoy a la derecha",
  "st.due_soon": "Próximas a repasar",
  "st.due_soon_empty": "Nada pendiente por ahora 👌",
  "st.export": "Exportar progreso",
  "st.import": "Importar progreso",
  "st.export_ok": "Exportado ✓",
  "st.import_ok": "Importado ✓",
  "st.export_fail": "No se pudo exportar",
  "st.import_fail": "No se pudo importar",
};

const EN: Table = {
  "app.brand": "TuaLingua",
  "app.tagline": "Learn a language, straight to the point",
  "app.retry": "Retry",
  "app.something_went_wrong": "Something went wrong",
  "app.close": "Close",

  "lang.en": "English",
  "lang.ru": "Russian",

  "level.1": "Novice",
  "level.2": "Curious",
  "level.3": "Chatterbox",
  "level.4": "Traveler",
  "level.5": "Chatty",
  "level.6": "Near fluent",
  "level.7": "Language master",

  "home.change_lang": "Change language",
  "home.level_short": "Lv {n}",
  "home.unmute": "Unmute sounds",
  "home.mute": "Mute",
  "home.stats": "Statistics",
  "home.goal": "Daily goal",
  "home.goal_done": "Daily goal done! 🎉",
  "home.review_title": "Smart review",
  "home.review_one": "1 word to review",
  "home.review_many": "{n} words to review",
  "home.review_go": "Review ›",
  "home.tile_dict": "Dictionary",
  "home.tile_dict_sub": "Browse by category",
  "home.tile_flash": "Flashcards",
  "home.tile_deck_empty": "Build your deck",
  "home.tile_deck_one": "1 word in your deck",
  "home.tile_deck_many": "{n} words in your deck",
  "home.key_phrases": "Key phrases",
  "home.listen": "Listen",
  "home.start": "Start",
  "home.repeat": "Redo lesson",
  "home.xp_suffix": "{n}+ XP",
  "home.pick_title": "Choose a language",
  "home.pick_note": "Progress is saved per language; XP and streak are app-wide.",
  "home.pick_level": "Level {level}",
  "home.back": "Back",
  "home.switch_title": "Switch to {lang}?",
  "home.switch_note":
    "Level {level}. XP and streak are app-wide; the deck and review are per language.",
  "home.switch_go": "Switch to {lang}",

  "p.exit": "Exit",
  "p.exit_title": "Leave this session?",
  "p.exit_note": "You will lose this session's progress.",
  "p.exit_yes": "Leave",
  "p.exit_no": "Keep going",
  "p.skip": "I don't know",
  "p.continue": "Continue",
  "p.check": "Check",
  "p.build_hint": "Tap the words in order…",
  "p.ko": "So close…",
  "p.listen": "Listen",
  "p.listen_slow": "Listen slowly",
  "p.listen_again": "Play again",
  "p.type_placeholder": "Type in {lang}…",
  "p.review_icon": "Review",
  "q.choice": "How do you say «{es}»?",
  "q.type_intro": "Type in {lang}: «{es}»",
  "q.listen_intro": "Listen and pick the translation",

  "s.accuracy": "accuracy",
  "s.title_lesson": "Lesson complete!",
  "s.title_review": "Review complete!",
  "s.title_flash": "Practice complete!",
  "s.correct_of": "{n} of {total} correct",
  "s.combo": " · ×{n} combo 🔥",
  "s.level_up": "🏅 Level {n}: {title}!",
  "s.streak_up": "🔥 {n}-day streak",
  "s.new_words": "New words",
  "s.listen": "Listen",
  "s.foot": "⚡ {xp} total XP · 📚 {words} {s}",
  "s.word_one": "word",
  "s.word_many": "words",
  "s.save_warning": "⚠️ Your progress could not be saved to disk.",
  "s.retry": "Redo",

  "d.title": "Dictionary",
  "d.back": "Back",
  "d.see_deck": "See your deck",
  "d.search": "Search word",
  "d.search_ph": "Search a word… ({lang} or Spanish)",
  "d.results_one": "1 result",
  "d.results_many": "{n} results",
  "d.cat_words": "{emoji} {title} · {n} {s}",
  "d.word_one": "word",
  "d.word_many": "words",
  "d.no_results": "No results for «{q}»",
  "d.listen": "Listen to {word}",
  "d.add": "Add to deck",
  "d.remove": "Remove from deck",
  "pos.n": "noun",
  "pos.v": "verb",
  "pos.adj": "adjective",
  "pos.adv": "adverb",
  "pos.phr": "phrase",

  "f.title": "Flashcards",
  "f.empty_title": "Your deck is empty",
  "f.empty_text":
    "Pick words in the dictionary and they will show up here so you can study them with cards and exercises.",
  "f.go_dict": "Open the dictionary 📖",
  "f.study": "🃏 Study cards",
  "f.practice": "✍️ Practice with exercises",
  "f.hint":
    "Tap the cards to flip from Spanish to the target language. Practice earns XP and feeds your review.",
  "f.deck": "Your deck",
  "f.listen": "Listen to {word}",
  "f.remove": "Remove from deck",
  "f.clear": "Clear deck",
  "f.confirm": "Sure? Tap again",
  "f.reveal": "Tap to reveal the word",
  "f.listen_btn": "Listen",
  "f.prev": "‹ Previous",
  "f.next": "Next ›",
  "f.finish": "Finish ›",
  "f.exit_study": "Exit study",
  "f.done": "Deck reviewed!",
  "f.done_text": "You reviewed {n} {s}.",
  "f.card_one": "card",
  "f.card_many": "cards",

  "st.title": "Your progress",
  "unit.lesson_one": "lesson",
  "unit.lesson_many": "lessons",
  "st.level_short": "Lv {n}",
  "st.xp_total": "Total XP",
  "st.streak": "Current streak",
  "st.best_streak": "Best streak",
  "st.accuracy": "Accuracy",
  "st.words": "Words learned",
  "st.due": "Due for review",
  "st.cards": "Active cards",
  "st.units": "Units",
  "st.close": "Close",
  "st.reset": "Reset progress",
  "st.confirm": "Sure? Tap again",
  "st.settings": "Settings",
  "st.daily_goal": "Daily goal",
  "st.daily_goal_hint": "XP you want to earn each day",
  "st.ui_lang": "Interface language",
  "st.calendar": "Streak calendar",
  "st.calendar_hint": "Last 3 months · today on the right",
  "st.due_soon": "Due next",
  "st.due_soon_empty": "Nothing due right now 👌",
  "st.export": "Export progress",
  "st.import": "Import progress",
  "st.export_ok": "Exported ✓",
  "st.import_ok": "Imported ✓",
  "st.export_fail": "Export failed",
  "st.import_fail": "Import failed",
};

const TABLES: Record<UiLang, Table> = {
  es: ES,
  en: EN,
};

const LIST_KEY = "tl-ui";
const DEFAULT_LANG: UiLang = "es";

function detectLang(): UiLang {
  if (typeof localStorage === "undefined") return DEFAULT_LANG;
  return localStorage.getItem(LIST_KEY) === "en" ? "en" : DEFAULT_LANG;
}

let current: UiLang = detectLang();
const listeners = new Set<() => void>();

export function uiLang(): UiLang {
  return current;
}

export function setUiLang(lang: UiLang) {
  if (lang === current) return;
  current = lang;
  if (typeof localStorage !== "undefined") localStorage.setItem(LIST_KEY, lang);
  listeners.forEach((fn) => fn());
}

export function useUiLang(): UiLang {
  const [, bump] = useReducer((c: number) => c + 1, 0);
  useEffect(() => {
    const fn = () => bump();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return current;
}

/** Sustitución simple sin depender de String.replaceAll (ES2021). */
function replaceAllOf(text: string, find: string, value: string): string {
  const parts = text.split(find);
  return parts.length <= 1 ? text : parts.join(value);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const out = TABLES[current][key] ?? ES[key] ?? key;
  if (!vars) return out;
  return Object.entries(vars).reduce(
    (acc, [k, v]) => replaceAllOf(acc, `{${k}}`, String(v)),
    out,
  );
}

export function targetLangName(id: string): string {
  return t(`lang.${id}`);
}

export function levelTitle(level: number): string {
  return t(`level.${Math.max(1, Math.min(7, level))}`);
}

const PRAISES: Record<UiLang, string[]> = {
  es: ["¡Perfecto!", "¡Genial!", "¡Muy bien!", "¡Exacto!", "¡Así se hace!", "¡Eres un crack!"],
  en: ["Perfect!", "Great!", "Very good!", "Exactly!", "That's the way!", "You're on fire!"],
};

export function randomPraise(): string {
  const list = PRAISES[current];
  return list[Math.floor(Math.random() * list.length)];
}

export function plural(
  n: number,
  oneKey: string,
  manyKey: string,
  vars?: Record<string, string | number>,
): string {
  return t(n === 1 ? oneKey : manyKey, vars);
}
