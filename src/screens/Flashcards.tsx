import { useMemo, useRef, useState } from "react";
import type { DictCategory, Phrase, VocabWord } from "../types";
import { shuffled } from "../lib/text";
import { sfx, speak, vibrate } from "../lib/audio";
import { plural, t, useUiLang } from "../i18n";
import { deckKeyOf } from "./Dictionary";
import { IconChevronLeft, IconVolume, IconCheck, IconX, IconPlus, IconCards } from "../components/icons";

const DECK_SOURCE = "deck";

export default function Flashcards({
  categories,
  deck,
  onBack,
  onToggle,
  onClear,
  onAddAll,
  onOpenDictionary,
  onStartQuiz,
}: {
  categories: DictCategory[];
  deck: Phrase[];
  onBack: () => void;
  onToggle: (phrase: Phrase) => void;
  onClear: () => void;
  onAddAll: (words: Phrase[]) => void;
  onOpenDictionary: () => void;
  onStartQuiz: (words: VocabWord[]) => void;
}) {
  useUiLang();
  const [source, setSource] = useState(DECK_SOURCE);
  const [studying, setStudying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const studyRef = useRef(Date.now());

  const posOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const cat of categories) {
      for (const w of cat.words) {
        if (w.pos) m.set(deckKeyOf(w), w.pos);
      }
    }
    return m;
  }, [categories]);

  const deckSet = useMemo(() => new Set(deck.map(deckKeyOf)), [deck]);
  const isDeck = source === DECK_SOURCE;
  const category = isDeck ? undefined : categories.find((c) => c.id === source);
  const words = isDeck ? deck : category?.words ?? [];

  if (studying && words.length) {
    return (
      <StudyMode
        cards={words}
        posOf={posOf}
        seed={studyRef.current}
        onExit={() => setStudying(false)}
      />
    );
  }

  function clearDeck() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onClear();
  }

  const pending = words.filter((w) => !deckSet.has(deckKeyOf(w)));

  return (
    <div className="screen fc">
      <header className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label={t("d.back")}>
          <IconChevronLeft size={22}/>
        </button>
        <h2 className="page-title">{t("f.title")}</h2>
        <button
          className={`chip-stat deck-chip ${isDeck ? "on-deck" : ""}`}
          onClick={() => {
            sfx.tap();
            setSource(DECK_SOURCE);
          }}
          aria-label={t("f.source_deck")}
        >
          <IconCards size={16}/> <b>{deck.length}</b>
        </button>
      </header>

      <div className="chip-row" role="tablist" aria-label={t("f.title")}>
        <button
          role="tab"
          aria-selected={isDeck}
          className={`cat-chip ${isDeck ? "on" : ""}`}
          onClick={() => {
            sfx.tap();
            setSource(DECK_SOURCE);
          }}
        >
          <IconCards size={14}/> {t("f.source_deck")}
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === source}
            className={`cat-chip ${c.id === source ? "on" : ""}`}
            onClick={() => {
              sfx.tap();
              setSource(c.id);
            }}
          >
            {c.emoji} {c.title}
          </button>
        ))}
      </div>

      {isDeck && deck.length === 0 ? (
        <div className="fc-empty">
          <div className="fc-empty-emoji"><IconCards size={48}/></div>
          <h3>{t("f.empty_title")}</h3>
          <p className="fc-empty-text">{t("f.empty_text")}</p>
          <button className="btn big btn-primary" onClick={onOpenDictionary}>
            {t("f.go_dict")}
          </button>
        </div>
      ) : (
        <>
          <p className="dict-meta">
            {isDeck
              ? plural(deck.length, "f.deck_words_one", "f.deck_words_many")
              : t("d.cat_words", {
                  emoji: category?.emoji ?? "",
                  title: category?.title ?? "",
                  n: words.length,
                  s: plural(words.length, "d.word_one", "d.word_many"),
                })}
          </p>

          <div className="fc-actions">
            <button
              className="btn big btn-primary"
              disabled={words.length === 0}
              onClick={() => {
                studyRef.current = Date.now();
                sfx.tap();
                setStudying(true);
              }}
            >
              {t("f.study")}
            </button>
            <button
              className="btn big ghost"
              onClick={() => onStartQuiz(words)}
              disabled={words.length < 2}
            >
              {t("f.practice")}
            </button>
            {!isDeck &&
              (pending.length > 0 ? (
                <button
                  className="btn big deck-add-btn"
                  onClick={() => {
                    sfx.tap();
                    onAddAll(words.filter((w) => !deckSet.has(deckKeyOf(w))));
                  }}
                >
                  ＋ {t("f.add_all", { n: pending.length })}
                </button>
              ) : (
                <p className="fc-deck-done"><IconCheck size={14}/> {t("f.add_all_done")}</p>
              ))}
          </div>
          <p className="fc-hint">{t("f.hint")}</p>

          <p className="sheet-label">{isDeck ? t("f.deck") : category?.title ?? ""}</p>
          <div className="word-list">
            {words.map((p) => {
              const key = deckKeyOf(p);
              const picked = deckSet.has(key);
              const pos = posOf.get(key);
              return (
                <div className={`word-row ${picked ? "picked" : ""}`} key={key}>
                  <div className="word-click">
                    <p className="word-en">
                      {p.t}
                      {pos && <span className="pos-pill">{t(`pos.${pos}`)}</span>}
                    </p>
                    <p className="word-es">{p.es}</p>
                  </div>
                  <div className="word-actions">
                    <button className="spk" onClick={() => speak(p.t)} aria-label={t("f.listen", { word: p.t })}>
                      <IconVolume size={18}/>
                    </button>
                    <button
                      className={`pick ${picked ? "on" : ""}`}
                      onClick={() => {
                        sfx.tap();
                        onToggle(p);
                      }}
                      aria-label={picked ? t("d.remove") : t("d.add")}
                    >
                      {isDeck ? <IconX size={15}/> : picked ? <IconCheck size={15}/> : <IconPlus size={15}/>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {isDeck && (
            <button className="btn big danger-btn fc-clear" onClick={clearDeck}>
              {confirming ? t("f.confirm") : t("f.clear")}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function StudyMode({
  cards,
  posOf,
  seed,
  onExit,
}: {
  cards: Phrase[];
  posOf: Map<string, string>;
  seed: number;
  onExit: () => void;
}) {
  useUiLang();
  const order = useMemo(() => shuffled(cards, seed), [cards, seed]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = order[i];
  const done = i >= order.length;
  const pos = done ? undefined : posOf.get(deckKeyOf(card));

  function reveal() {
    if (done) return;
    if (flipped) {
      setFlipped(false);
      return;
    }
    sfx.tap();
    setFlipped(true);
    speak(card.t);
  }

  function next() {
    if (done) return;
    vibrate(10);
    setFlipped(false);
    setI((v) => v + 1);
  }

  function prev() {
    if (i === 0) return;
    setFlipped(false);
    setI((v) => v - 1);
  }

  if (done) {
    return (
      <div className="screen fc">
        <div className="fc-end">
          <div className="fc-empty-emoji done"><IconCheck size={40}/></div>
          <h3>{t("f.done")}</h3>
          <p className="fc-empty-text">
            {t("f.done_text", {
              n: order.length,
              s: plural(order.length, "f.card_one", "f.card_many"),
            })}
          </p>
          <button className="btn big btn-primary" onClick={onExit}>
            {t("home.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen fc study">
      <header className="page-head">
        <button className="icon-btn" onClick={onExit} aria-label={t("f.exit_study")}>
          <IconX size={20}/>
        </button>
        <p className="fc-progress">
          {i + 1} / {order.length}
        </p>
        <span className="chip-stat dim">🃏</span>
      </header>

      <div
        className={`fc-card ${flipped ? "flip" : ""}`}
        onClick={reveal}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") reveal();
        }}
        aria-label={flipped ? card.t : `${card.es} · ${t("f.reveal")}`}
      >
        {!flipped ? (
          <>
            <p className="fc-front">{card.es}</p>
            <p className="fc-hint">{t("f.reveal")}</p>
          </>
        ) : (
          <>
            <p className="fc-back">{card.t}</p>
            {pos && <span className="pos-pill">{t(`pos.${pos}`)}</span>}
            <button
              className="spk big-spk"
              onClick={(e) => {
                e.stopPropagation();
                speak(card.t);
              }}
              aria-label={t("f.listen_btn")}
            >
              <IconVolume size={18}/>
            </button>
          </>
        )}
      </div>

      <div className="fc-foot">
        <button className="btn ghost" onClick={prev} disabled={i === 0}>
          {t("f.prev")}
        </button>
        <button className="btn btn-primary" onClick={next}>
          {i + 1 === order.length ? t("f.finish") : t("f.next")}
        </button>
      </div>
    </div>
  );
}
