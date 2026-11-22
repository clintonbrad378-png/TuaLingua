import { useEffect, useState } from "react";
import type { SessionSummary } from "../types";
import { sfx, speak } from "../lib/audio";
import { levelTitle, plural, t, useUiLang } from "../i18n";
import Confetti from "../components/Confetti";
import { IconVolume } from "../components/icons";
import BrandMark from "../components/BrandMark";

export default function Summary({
  summary,
  mode,
  lessonTitle,
  onContinue,
  onRetry,
}: {
  summary: SessionSummary;
  mode: "lesson" | "review" | "flash";
  lessonTitle?: string;
  onContinue: () => void;
  onRetry?: () => void;
}) {
  useUiLang();
  const [xpShown, setXpShown] = useState(0);
  const [ringOn, setRingOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (summary.level_up) sfx.levelUp();
    else sfx.complete();
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    setXpShown(reduce ? summary.xp_gained : 0);
    if (reduce) setRingOn(true);
    const t1 = window.setTimeout(() => setRingOn(true), 120);
    const start = performance.now();
    const duration = 900;
    let raf = 0;
    const tick = (now: number) => {
      const time = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - time, 3);
      setXpShown(Math.round(summary.xp_gained * eased));
      if (time < 1) raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      clearTimeout(t1);
      cancelAnimationFrame(raf);
    };
  }, [summary]);

  const R = 62;
  const C = 2 * Math.PI * R;
  const ringPct = summary.total > 0 ? summary.accuracy / 100 : 0;
  const grade =
    summary.accuracy >= 90
      ? "A"
      : summary.accuracy >= 80
        ? "B"
        : summary.accuracy >= 70
          ? "C"
          : summary.accuracy >= 55
            ? "D"
            : "F";

  return (
    <div className="screen summary">
      <Confetti />
      <div className="ring-wrap">
        <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden="true">
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
            <small>{t("s.accuracy")}</small>
          </div>
        </div>
      </div>

      <div className={`summary-mark ${mounted ? "in" : ""}`} aria-hidden="true">
        <BrandMark size={72} />
      </div>

      <h1 aria-live="polite">
        {mode === "review" ? t("s.title_review") : mode === "flash" ? t("s.title_flash") : t("s.title_lesson")}
      </h1>
      {lessonTitle && <p className="summary-sub">{lessonTitle}</p>}

      <div className="stars-row" aria-label={`${summary.stars}/3 ⭐`}>
        {[1, 2, 3].map((s) => (
          <span key={s} className={summary.stars >= s ? "on" : ""}>
            ★
          </span>
        ))}
      </div>

      <p className={`grade grade-${grade}`} role="img" aria-label={t("s.grade")}>
        {grade}
      </p>

      <p className="xp-count">+{xpShown} XP</p>
      <p className="summary-detail">
        {t("s.correct_of", { n: summary.correct, total: summary.total })}
        {summary.combo_max >= 3 ? t("s.combo", { n: summary.combo_max }) : ""}
      </p>

      {!summary.save_ok && <p className="save-warn">{t("s.save_warning")}</p>}

      {summary.level_up && (
        <div className="banner level">
          {t("s.level_up", { n: summary.level, title: levelTitle(summary.level) })}
        </div>
      )}
      {summary.streak_up && summary.streak > 1 && (
        <div className="banner streak">{t("s.streak_up", { n: summary.streak })}</div>
      )}

      {summary.new_words.length > 0 && (
        <div className="new-words">
          <p className="sheet-label">{t("s.new_words")}</p>
          {summary.new_words.map((w, i) => (
            <div className="word-chip" key={i}>
              <span>
                {w.es} <b>→</b> {w.t}
              </span>
              <button className="spk" onClick={() => speak(w.t)} aria-label={t("s.listen")}>
                <IconVolume size={18}/>
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="summary-foot">
        {t("s.foot", {
          xp: summary.total_xp,
          words: summary.words_learned,
          s: plural(summary.words_learned, "s.word_one", "s.word_many"),
        })}
      </p>

      <div className="summary-actions">
        {onRetry && (
          <button className="btn big ghost" onClick={onRetry}>
            {t("s.retry")}
          </button>
        )}
        <button className="btn big btn-primary" onClick={onContinue}>
          {t("p.continue")}
        </button>
      </div>
    </div>
  );
}
