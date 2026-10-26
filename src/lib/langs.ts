import type { LanguageInfo } from "../types";

export const LANGS: LanguageInfo[] = [
  {
    id: "en",
    title: "Inglés",
    emoji: "🇬🇧",
    bcp47: "en-US",
    level: "A1–B2",
  },
  {
    id: "ru",
    title: "Ruso",
    emoji: "🇷🇺",
    bcp47: "ru-RU",
    level: "A1–B2",
  },
];

export const DEFAULT_LANG = "en";

export function langOf(id: string): LanguageInfo {
  return LANGS.find((l) => l.id === id) ?? LANGS[0];
}

export function langTitle(id: string): string {
  return langOf(id).title;
}

export function langBcp47(id: string): string {
  return langOf(id).bcp47;
}
