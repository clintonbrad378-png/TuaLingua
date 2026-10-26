import { useMemo, useRef, useState } from "react";
import type { DictCategory, Phrase } from "../types";
import { shuffled } from "../lib/text";
import { sfx, speak, vibrate } from "../lib/audio";
import { deckKeyOf } from "./Dictionary";

export default function Flashcards({
  dictCategories,
  deck,
  onBack,
  onRemove,
  onClear,
  onOpenDictionary,
  onStartQuiz,
}: {
  dictCategories: DictCategory[];
  deck: Phrase[];
  onBack: () => void;
  onRemove: (phrase: Phrase) => void;
  onClear: () => void;
  onOpenDictionary: () => void;
  onStartQuiz: () => void;
}) {
  const [studying, setStudying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const studyRef = useRef(Date.now());

  const posOf = useMemo(() => {
    const m = new Map<string, string>();
    for (const cat of dictCategories) {
      for (const w of cat.words) {
        if (w.pos) m.set(deckKeyOf(w), w.pos);
      }
    }
    return m;
  }, [dictCategories]);

  if (studying) {
    return (
      <StudyMode
        cards={deck}
        posOf={posOf}
        seed={studyRef.current}
        onExit={() => setStudying(false)}
      />
    );
  }

  async function clearDeck() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onClear();
  }

  return (
    <div className="screen fc">
      <header className="page-head">
        <button className="icon-btn" onClick={onBack} aria-label="Volver">
          ‹
        </button>
        <h2 className="page-title">Flashcards</h2>
        <span className="chip-stat dim">🃏 <b>{deck.length}</b></span>
      </header>

      {deck.length === 0 ? (
        <div className="fc-empty">
          <p className="fc-empty-emoji">🃏</p>
          <h3>Tu mazo está vacío</h3>
          <p className="fc-empty-text">
            Elige palabras en el diccionario y aparecerán aquí para estudiarlas
            con tarjetas y ejercicios.
          </p>
          <button className="btn big btn-primary" onClick={onOpenDictionary}>
            Ir al diccionario 📖
          </button>
        </div>
      ) : (
        <>
          <div className="fc-actions">
            <button
              className="btn big btn-primary"
              onClick={() => {
                studyRef.current = Date.now();
                sfx.tap();
                setStudying(true);
              }}
            >
              🃏 Estudiar tarjetas
            </button>
            <button
              className="btn big ghost"
              onClick={onStartQuiz}
              disabled={deck.length < 2}
            >
              ✍️ Practicar con ejercicios
            </button>
          </div>
          <p className="fc-hint">
            Toca las tarjetas para pasar del español al inglés. Practicar genera
            XP y refuerza tu repaso.
          </p>

          <p className="sheet-label">Tu mazo</p>
          <div className="word-list">
            {deck.map((p) => {
              const pos = posOf.get(deckKeyOf(p));
              return (
                <div className="word-row" key={deckKeyOf(p)}>
                  <div className="word-click">
                    <p className="word-en">
                      {p.t}
                      {pos && <span className="pos-pill">{pos}</span>}
                    </p>
                    <p className="word-es">{p.es}</p>
                  </div>
                  <div className="word-actions">
                    <button className="spk" onClick={() => speak(p.t)} aria-label={`Escuchar ${p.t}`}>
                      🔊
                    </button>
                    <button
                      className="pick on"
                      onClick={() => {
                        sfx.tap();
                        onRemove(p);
                      }}
                      aria-label="Quitar del mazo"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="btn big danger-btn fc-clear" onClick={clearDeck}>
            {confirming ? "¿Seguro? Toca otra vez" : "Vaciar mazo"}
          </button>
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
  const order = useMemo(() => shuffled(cards, seed), [cards, seed]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = order[i];
  const pos = posOf.get(deckKeyOf(card));
  const done = i >= order.length;

  function reveal() {
    if (done || flipped) return;
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
          <p className="fc-empty-emoji">✅</p>
          <h3>¡Mazo revisado!</h3>
          <p className="fc-empty-text">
            Has repasado {order.length} {order.length === 1 ? "tarjeta" : "tarjetas"}.
          </p>
          <button className="btn big btn-primary" onClick={onExit}>
            Volver al mazo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen fc study">
      <header className="page-head">
        <button className="icon-btn" onClick={onExit} aria-label="Salir del estudio">
          ✕
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
          if (e.key === "Enter") reveal();
        }}
        aria-label={flipped ? card.t : card.es}
      >
        {!flipped ? (
          <>
            <p className="fc-front">{card.es}</p>
            <p className="fc-hint">Toca para ver la palabra</p>
          </>
        ) : (
          <>
            <p className="fc-back">{card.t}</p>
            {pos && <span className="pos-pill">{pos}</span>}
            <button
              className="spk big-spk"
              onClick={(e) => {
                e.stopPropagation();
                speak(card.t);
              }}
              aria-label="Escuchar"
            >
              🔊
            </button>
          </>
        )}
      </div>

      <div className="fc-foot">
        <button className="btn ghost" onClick={prev} disabled={i === 0}>
          ‹ Anterior
        </button>
        <button className="btn btn-primary" onClick={next} disabled={flipped}>
          {i + 1 === order.length ? "Terminar ›" : "Siguiente ›"}
        </button>
      </div>
    </div>
  );
}
