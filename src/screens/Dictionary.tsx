import { useMemo, useState } from "react";
import type { DictCategory, DictEntry, Phrase } from "../types";
import { normalize } from "../lib/text";
import { speak, sfx, vibrate } from "../lib/audio";
import { IconChevronLeft, IconVolume, IconCheck, IconPlus, IconSearch } from "../components/icons";
import { plural, targetLangName, t, useUiLang } from "../i18n";

export const POS_KEYS: Record<string, string> = {
  n: "pos.n",
  v: "pos.v",
  adj: "pos.adj",
  adv: "pos.adv",
  phr: "pos.phr",
};

const MAX_RESULTS = 90;

export function deckKeyOf(phrase: { es: string; t: string }): string {
  return `${normalize(phrase.es)}|${normalize(phrase.t)}`;
}

/** Distancia de Levenshtein acotada para búsqueda difusa. */
function levenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  let cur = new Array<number>(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

/** Coincidencia exacta o difusa (typo ≤ 2 caracteres en consultas largas). */
function matches(entry: DictEntry, query: string): boolean {
  const t = normalize(entry.t);
  const es = normalize(entry.es);
  if (t.includes(query) || es.includes(query)) return true;
  if (query.length >= 3) {
    return (
      levenshtein(t, query) <= 2 || levenshtein(es, query) <= 2
    );
  }
  return false;
}

export default function Dictionary({
  lang,
  categories,
  deck,
  onBack,
  onToggle,
  onSeeDeck,
}: {
  lang: string;
  categories: DictCategory[];
  deck: Phrase[];
  onBack: () => void;
  onToggle: (phrase: Phrase) => void;
  onSeeDeck: () => void;
}) {
  useUiLang();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState(categories[0]?.id ?? "");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const deckSet = useMemo(() => new Set(deck.map(deckKeyOf)), [deck]);

  const active = categories.find((c) => c.id === activeCat) ?? categories[0];

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    const out: { entry: DictEntry; cat: DictCategory }[] = [];
    for (const cat of categories) {
      for (const entry of cat.words) {
        if (matches(entry, q)) {
          out.push({ entry, cat });
          if (out.length >= MAX_RESULTS) return out;
        }
      }
    }
    return out;
  }, [query, categories]);

  const picked = (p: { es: string; t: string }) => deckSet.has(deckKeyOf(p));

  function toggle(phrase: Phrase) {
    sfx.tap();
    vibrate(12);
    onToggle(phrase);
  }

  const shown = query.trim() ? results.map((r) => r.entry) : active?.words ?? [];
  const rowKey = (w: DictEntry) => `${w.es}|${w.t}`;

  return (
    <div className="screen dict">
      <header className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label={t("d.back")}>
          <IconChevronLeft size={22}/>
        </button>
        <h2 className="page-title">{t("d.title")}</h2>
        <button className="chip-stat deck-chip" onClick={onSeeDeck} aria-label={t("d.see_deck")}>
          <span className="deck-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="7" y="7" width="12" height="14" rx="2"/><path d="M5 17V5a2 2 0 0 1 2-2h10"/></svg></span> <b>{deck.length}</b>
        </button>
      </header>

      <input
        className="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("d.search_ph", { lang: targetLangName(lang) })}
        aria-label={t("d.search")}
        spellCheck={false}
      />

      {!query.trim() && (
        <div className="chip-row" role="tablist" aria-label={t("home.tile_dict_sub")}>
          {categories.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === active?.id}
              className={`cat-chip ${c.id === active?.id ? "on" : ""}`}
              onClick={() => {
                sfx.tap();
                setActiveCat(c.id);
              }}
            >
              {c.emoji} {c.title}
            </button>
          ))}
        </div>
      )}

      {query.trim() && results.length === 0 ? (
        <div className="dict-empty">
          <div className="dict-empty-emoji"><IconSearch size={40}/></div>
          <p>{t("d.no_results", { q: query })}</p>
        </div>
      ) : (
        <p className="dict-meta">
          {query.trim()
            ? plural(results.length, "d.results_one", "d.results_many", { n: results.length })
            : t("d.cat_words", {
                emoji: active?.emoji ?? "",
                title: active?.title ?? "",
                n: active?.words.length ?? 0,
                s: plural(active?.words.length ?? 0, "d.word_one", "d.word_many"),
              })}
        </p>
      )}

      <div className="word-list">
        {shown.map((w) => {
          const key = rowKey(w);
          const isOpen = openKey === key;
          const isPicked = picked(w);
          return (
            <div className={`word-row ${isPicked ? "picked" : ""}`} key={key}>
              <div
                className="word-click"
                role="button"
                tabIndex={0}
                onClick={() => setOpenKey((k) => (k === key ? null : key))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    setOpenKey((k) => (k === key ? null : key));
                }}
              >
                <p className="word-en">
                  {w.t}
                  {w.pos && <span className="pos-pill">{w.pos === "phr" || !POS_KEYS[w.pos] ? t(`pos.${w.pos}`) : t(POS_KEYS[w.pos])}</span>}
                </p>
                <p className="word-es">{w.es}</p>
              </div>
              <div className="word-actions">
                <button className="spk" onClick={() => speak(w.t)} aria-label={t("d.listen", { word: w.t })}>
                  <IconVolume size={18}/>
                </button>
                <button
                  className={`pick ${isPicked ? "on" : ""}`}
                  onClick={() => toggle({ es: w.es, t: w.t })}
                  aria-label={isPicked ? t("d.remove") : t("d.add")}
                >
                  {isPicked ? <IconCheck size={16}/> : <IconPlus size={16}/>}
                </button>
              </div>
              {isOpen && w.ex && (
                <div className="word-ex">
                  <p className="ex-en">{w.ex.t}</p>
                  <p className="ex-es">{w.ex.es}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
