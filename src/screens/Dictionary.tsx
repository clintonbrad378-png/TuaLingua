import { useMemo, useState } from "react";
import type { DictCategory, DictEntry, Phrase } from "../types";
import { normalize } from "../lib/text";
import { speak, sfx, vibrate } from "../lib/audio";
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

function matches(entry: DictEntry, query: string): boolean {
  return normalize(entry.t).includes(query) || normalize(entry.es).includes(query);
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

  return (
    <div className="screen dict">
      <header className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label={t("d.back")}>
          ‹
        </button>
        <h2 className="page-title">{t("d.title")}</h2>
        <button className="chip-stat deck-chip" onClick={onSeeDeck} aria-label={t("d.see_deck")}>
          🃏 <b>{deck.length}</b>
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
          <p className="dict-empty-emoji">🔍</p>
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
          const key = w.t;
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
                  🔊
                </button>
                <button
                  className={`pick ${isPicked ? "on" : ""}`}
                  onClick={() => toggle({ es: w.es, t: w.t })}
                  aria-label={isPicked ? t("d.remove") : t("d.add")}
                >
                  {isPicked ? "✓" : "＋"}
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
