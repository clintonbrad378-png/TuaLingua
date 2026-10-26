import { useEffect, useState } from "react";
import type { LanguageInfo, Lesson, ProgressState, Unit } from "../types";
import { setMuted, speak } from "../lib/audio";
import { langOf } from "../lib/langs";
import Mascot from "../components/Mascot";

export default function Home({
  langs,
  lang,
  switching,
  onSwitchPick,
  onSwitchConfirm,
  onSwitchCancel,
  units,
  progress,
  onStart,
  onReview,
  onStats,
  onDictionary,
  onFlashcards,
}: {
  langs: LanguageInfo[];
  lang: string;
  switching: string | null;
  onSwitchPick: (id: string) => void;
  onSwitchConfirm: () => void;
  onSwitchCancel: () => void;
  units: Unit[];
  progress: ProgressState;
  onStart: (unit: Unit, lesson: Lesson) => void;
  onReview: () => void;
  onStats: () => void;
  onDictionary: () => void;
  onFlashcards: () => void;
}) {
  const [preview, setPreview] = useState<{ unit: Unit; lesson: Lesson } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [muted, setMutedUi] = useState(() => localStorage.getItem("tl-muted") === "1");

  useEffect(() => {
    setMuted(muted);
    localStorage.setItem("tl-muted", muted ? "1" : "0");
  }, [muted]);

  const done = (id: string) => (progress.lessons[id]?.stars ?? 0) > 0;
  const starsOf = (id: string) => progress.lessons[id]?.stars ?? 0;

  const unlocked = (unitIdx: number, lessonIdx: number) => {
    if (unitIdx === 0 && lessonIdx === 0) return true;
    if (lessonIdx === 0) {
      const prev = units[unitIdx - 1];
      return done(prev.lessons[prev.lessons.length - 1].id);
    }
    return done(units[unitIdx].lessons[lessonIdx - 1].id);
  };

  const goalPct = Math.min(100, Math.round((progress.xp_today / progress.daily_goal) * 100));
  const goalDone = progress.xp_today >= progress.daily_goal;

  const switchingLang = switching ? langs.find((l) => l.id === switching) : null;

  return (
    <div className="screen home">
      <header className="home-head">
        <button
          className="lang-btn"
          onClick={() => setPickOpen(true)}
          aria-label="Cambiar idioma"
        >
          {langOf(lang).emoji} {langOf(lang).title}
        </button>
        <div className="chip-stat">
          🔥 <b>{progress.streak}</b>
        </div>
        <div className="chip-stat">
          ⚡ <b>{progress.xp}</b>
        </div>
        <div className="chip-stat">
          🏅 <b>Nv {progress.level}</b>
        </div>
        <button className="mute-btn" onClick={() => setMutedUi((m) => !m)} aria-label={muted ? "Activar sonidos" : "Silenciar"}>
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="avatar-btn" onClick={onStats} aria-label="Estadísticas">
          <Mascot mood="idle" size={44} />
        </button>
      </header>

      <section className="card goal-card">
        <div className="goal-top">
          <strong>{goalDone ? "¡Meta diaria completada! 🎉" : "Meta diaria"}</strong>
          <span>
            {progress.xp_today}/{progress.daily_goal} XP
          </span>
        </div>
        <div className="goal-bar">
          <span style={{ width: `${goalPct}%` }} />
        </div>
      </section>

      {progress.due_count > 0 && (
        <button className="card review-card" onClick={onReview}>
          <span className="review-ico">🧠</span>
          <span className="review-text">
            <strong>Repaso inteligente</strong>
            <small>
              {progress.due_count} {progress.due_count === 1 ? "palabra toca repasar" : "palabras tocan repasar"}
            </small>
          </span>
          <span className="review-go">Repasar ›</span>
        </button>
      )}

      <div className="home-grid">
        <button className="tile" onClick={onDictionary}>
          <span className="tile-ico">📖</span>
          <strong>Diccionario</strong>
          <small>Consulta por categorías</small>
        </button>
        <button className="tile" onClick={onFlashcards}>
          <span className="tile-ico">🃏</span>
          <strong>Flashcards</strong>
          <small>
            {progress.deck_count === 0
              ? "Crea tu mazo"
              : `${progress.deck_count} ${progress.deck_count === 1 ? "palabra" : "palabras"} en tu mazo`}
          </small>
        </button>
      </div>

      {units.map((unit, ui) => {
        const totalStars = unit.lessons.reduce((acc, l) => acc + starsOf(l.id), 0);
        return (
          <section key={unit.id} className="unit">
            <div className="unit-head">
              <div className="unit-emoji" style={{ boxShadow: `0 3px 0 ${unit.color}55` }}>
                {unit.emoji}
              </div>
              <div>
                <p className="unit-title">{unit.title}</p>
                <p className="unit-sub">
                  {totalStars}/{unit.lessons.length * 3} ⭐ · {unit.lessons.length} lecciones
                </p>
              </div>
            </div>
            <div className="path">
              {unit.lessons.map((lesson, li) => {
                const isDone = done(lesson.id);
                const isOpen = unlocked(ui, li);
                return (
                  <button
                    key={lesson.id}
                    className={`node path-${li % 4} ${isDone ? "done" : ""} ${isOpen ? "" : "locked"}`}
                    style={isDone ? { background: unit.color, boxShadow: `0 5px 0 ${unit.color}88` } : undefined}
                    disabled={!isOpen}
                    onClick={() => setPreview({ unit, lesson })}
                    aria-label={lesson.title}
                  >
                    {isOpen ? (isDone ? "✓" : unit.emoji) : "🔒"}
                    {isDone && (
                      <span className="node-stars">
                        {[1, 2, 3].map((s) => (
                          <i key={s} className={starsOf(lesson.id) >= s ? "on" : ""}>
                            ★
                          </i>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {preview && (
        <div className="overlay" onClick={() => setPreview(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-emoji">{preview.unit.emoji}</p>
            <h2>{preview.lesson.title}</h2>
            <p className="goal">{preview.lesson.goal}</p>

            <ul className="tips">
              {preview.lesson.tip.map((t, i) => (
                <li key={i}>💡 {t}</li>
              ))}
            </ul>

            <p className="sheet-label">Frases clave</p>
            {preview.lesson.phrases.map((p, i) => (
              <div className="phrase" key={i}>
                <div>
                  <p className="p-es">{p.es}</p>
                  <p className="p-en">{p.t}</p>
                </div>
                <button className="spk" onClick={() => speak(p.t)} aria-label="Escuchar">
                  🔊
                </button>
              </div>
            ))}

            <button
              className="btn big btn-primary sheet-start"
              onClick={() => {
                onStart(preview.unit, preview.lesson);
                setPreview(null);
              }}
            >
              {starsOf(preview.lesson.id) > 0 ? "Repetir lección" : "Empezar"} ·{" "}
              {preview.lesson.exercises.length * 10}+ XP
            </button>
          </div>
        </div>
      )}

      {pickOpen && !switching && (
        <div className="overlay" onClick={() => setPickOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-emoji">🌍</p>
            <h2>Elige un idioma</h2>
            <p className="goal">Tu progreso se guarda por idioma; el XP y la racha son de toda la app.</p>
            <div className="lang-list">
              {langs.map((l) => (
                <button
                  key={l.id}
                  className={`lang-row ${l.id === lang ? "current" : ""}`}
                  onClick={() => {
                    setPickOpen(false);
                    if (l.id !== lang) onSwitchPick(l.id);
                  }}
                >
                  <span className="lang-row-emoji">{l.emoji}</span>
                  <span className="lang-row-name">
                    <strong>{l.title}</strong>
                    <small>Nivel {l.level}</small>
                  </span>
                  {l.id === lang && <span className="lang-row-check">✓</span>}
                </button>
              ))}
            </div>
            <button className="btn big ghost" onClick={() => setPickOpen(false)}>
              Volver
            </button>
          </div>
        </div>
      )}

      {switching && switchingLang && (
        <div className="overlay" onClick={onSwitchCancel}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <p className="sheet-emoji">🌍</p>
            <h2>¿Cambiar a {switchingLang.title}?</h2>
            <p className="goal">
              Nivel {switchingLang.level}. Tu XP y racha son de toda la app; el mazo y el
              repaso son por idioma.
            </p>
            <button className="btn big btn-primary" onClick={onSwitchConfirm}>
              Cambiar a {switchingLang.emoji} {switchingLang.title}
            </button>
            <button className="btn big ghost" onClick={onSwitchCancel}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
