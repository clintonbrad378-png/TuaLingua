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
  {
    id: "it",
    title: "Italiano",
    emoji: "🇮🇹",
    bcp47: "it-IT",
    level: "A1–B2",
  },
  {
    id: "zh",
    title: "Chino mandarín",
    emoji: "🇨🇳",
    bcp47: "zh-CN",
    level: "A1–B1",
  },
  {
    id: "fr",
    title: "Francés",
    emoji: "🇫🇷",
    bcp47: "fr-FR",
    level: "A1–B1",
  },
  {
    id: "ar",
    title: "Árabe",
    emoji: "🇸🇦",
    bcp47: "ar-SA",
    level: "A1–B1",
  },
  {
    id: "de",
    title: "Alemán",
    emoji: "🇩🇪",
    bcp47: "de-DE",
    level: "A1–B1",
  },
  {
    id: "pt",
    title: "Portugués",
    emoji: "🇵🇹",
    bcp47: "pt-BR",
    level: "A1–B1",
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
