import { useMemo, useState } from "react";
import type { DictCategory, DictEntry, Phrase } from "../types";
import { normalize } from "../lib/text";
import { speak, sfx, vibrate } from "../lib/audio";
import { langTitle } from "../lib/langs";

export const POS_LABEL: Record<string, string> = {
  n: "sustantivo",
  v: "verbo",
  adj: "adjetivo",
  adv: "adverbio",
  phr: "frase",
};

const MAX_RESULTS = 90;

export function deckKeyOf(phrase: { es: string; t: string }): string {
  return `${normalize(phrase.es)}|${normalize(phrase.t)}`;
}

function matches(entry: DictEntry, q: string): boolean {
  return normalize(entry.t).includes(q) || normalize(entry.es).includes(q);
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
        <button className="icon-btn" onClick={onBack} aria-label="Volver">
          ‹
        </button>
        <h2 className="page-title">Diccionario</h2>
        <button className="chip-stat deck-chip" onClick={onSeeDeck} aria-label="Ver tu mazo">
          🃏 <b>{deck.length}</b>
        </button>
      </header>

      <input
        className="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Buscar palabra… (${langTitle(lang)} o español)`}
        aria-label="Buscar palabra"
        spellCheck={false}
      />

      {!query.trim() && (
        <div className="chip-row" role="tablist" aria-label="Categorías">
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
          <p>
            Sin resultados para «<b>{query}</b>»
          </p>
        </div>
      ) : (
        <p className="dict-meta">
          {query.trim()
            ? `${shown.length} ${shown.length === 1 ? "resultado" : "resultados"}`
            : `${active?.emoji} ${active?.title} · ${active?.words.length} palabras`}
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
                  if (e.key === "Enter") setOpenKey((k) => (k === key ? null : key));
                }}
              >
                <p className="word-en">
                  {w.t}
                  {w.pos && <span className="pos-pill">{POS_LABEL[w.pos] ?? w.pos}</span>}
                </p>
                <p className="word-es">{w.es}</p>
              </div>
              <div className="word-actions">
                <button className="spk" onClick={() => speak(w.t)} aria-label={`Escuchar ${w.t}`}>
                  🔊
                </button>
                <button
                  className={`pick ${isPicked ? "on" : ""}`}
                  onClick={() => toggle({ es: w.es, t: w.t })}
                  aria-label={isPicked ? "Quitar del mazo" : "Añadir al mazo"}
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
