import { useEffect, useState } from "react";
import type { SessionSummary } from "../types";
import { sfx, speak } from "../lib/audio";
import Confetti from "../components/Confetti";
import Mascot from "../components/Mascot";

export default function Summary({
  summary,
  mode,
  lessonTitle,
  onContinue,
  onRetry,
}: {
  summary: SessionSummary;
  mode: "lesson" | "review";
  lessonTitle?: string;
  onContinue: () => void;
  onRetry?: () => void;
}) {
  const [xpShown, setXpShown] = useState(0);
  const [ringOn, setRingOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (summary.level_up) sfx.levelUp();
    else sfx.complete();
    const t1 = window.setTimeout(() => setRingOn(true), 120);
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setXpShown(Math.round(summary.xp_gained * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t1);
      cancelAnimationFrame(raf);
    };
  }, [summary]);

  const R = 62;
  const C = 2 * Math.PI * R;
  const ringPct = summary.total > 0 ? summary.accuracy / 100 : 0;

  return (
    <div className="screen summary">
      <Confetti />
      <div className="ring-wrap">
        <svg width="160" height="160" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={R} fill="none" stroke="#262146" strokeWidth="13" />
          <circle
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke="url(#ring-grad)"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={ringOn ? C * (1 - ringPct) : C}
            style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.3,.8,.3,1) .15s" }}
            transform="rotate(-90 80 80)"
          />
          <defs>
            <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#8E6FFF" />
              <stop offset="100%" stopColor="#00D4C8" />
            </linearGradient>
          </defs>
        </svg>
        <div className="ring-label">
          <div>
            <b>{summary.accuracy}%</b>
            <small>precisión</small>
          </div>
        </div>
      </div>

      <div className={`summary-mascot ${mounted ? "in" : ""}`}>
        <Mascot mood={summary.accuracy >= 70 ? "happy" : "idle"} size={92} />
      </div>

      <h1>{mode === "review" ? "¡Repaso completado!" : "¡Lección completada!"}</h1>
      {lessonTitle && <p className="summary-sub">{lessonTitle}</p>}

      <div className="stars-row">
        {[1, 2, 3].map((s) => (
          <span key={s} className={summary.stars >= s ? "on" : ""}>
            ★
          </span>
        ))}
      </div>

      <p className="xp-count">+{xpShown} XP</p>
      <p className="summary-detail">
        {summary.correct} de {summary.total} correctas
        {summary.combo_max >= 3 ? ` · combo ×${summary.combo_max} 🔥` : ""}
      </p>

      {summary.level_up && (
        <div className="banner level">
          🏅 ¡Nivel {summary.level}: {summary.level_title}!
        </div>
      )}
      {summary.streak_up && summary.streak > 1 && (
        <div className="banner streak">🔥 Racha de {summary.streak} días</div>
      )}

      {summary.new_words.length > 0 && (
        <div className="new-words">
          <p className="sheet-label">Palabras nuevas</p>
          {summary.new_words.map((w, i) => (
            <div className="word-chip" key={i}>
              <span>
                {w.es} <b>→</b> {w.en}
              </span>
              <button className="spk" onClick={() => speak(w.en)} aria-label="Escuchar">
                🔊
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="summary-foot">
        ⚡ {summary.total_xp} XP total · 📚 {summary.words_learned} palabras
      </p>

      <div className="summary-actions">
        {onRetry && (
          <button className="btn big ghost" onClick={onRetry}>
            Repetir
          </button>
        )}
        <button className="btn big btn-primary" onClick={onContinue}>
          Continuar
        </button>
      </div>
    </div>
  );
}
