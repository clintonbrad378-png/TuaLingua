import { useEffect, useRef, useState } from "react";
import type { LanguageInfo, Lesson, ProgressState, Unit } from "../types";
import { setMuted, speak } from "../lib/audio";
import { langOf } from "../lib/langs";
import { plural, targetLangName, t, useUiLang } from "../i18n";
import { useSheetFocus } from "../lib/focus";
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
  useUiLang();
  const [preview, setPreview] = useState<{ unit: Unit; lesson: Lesson } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [muted, setMutedUi] = useState(() => localStorage.getItem("tl-muted") === "1");
  const previewRef = useRef<HTMLDivElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const switchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMuted(muted);
    localStorage.setItem("tl-muted", muted ? "1" : "0");
  }, [muted]);

  useSheetFocus(previewRef, preview !== null, () => setPreview(null));
  useSheetFocus(pickRef, pickOpen, () => setPickOpen(false));
  useSheetFocus(
    switchRef,
    switching !== null,
    onSwitchCancel,
  );

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
          aria-label={t("home.change_lang")}
        >
          {langOf(lang).emoji} {targetLangName(lang)}
        </button>
        <div className="chip-stat">
          🔥 <b>{progress.streak}</b>
        </div>
        <div className="chip-stat">
          ⚡ <b>{progress.xp}</b>
        </div>
        <div className="chip-stat">
          🏅 <b>{t("home.level_short", { n: progress.level })}</b>
        </div>
        <button
          className="mute-btn"
          onClick={() => setMutedUi((m) => !m)}
          aria-label={muted ? t("home.unmute") : t("home.mute")}
        >
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="avatar-btn" onClick={onStats} aria-label={t("home.stats")}>
          <Mascot mood="idle" size={44} />
        </button>
      </header>

      <section className="card goal-card">
        <div className="goal-top">
          <strong>{goalDone ? t("home.goal_done") : t("home.goal")}</strong>
          <span>
            {progress.xp_today}/{progress.daily_goal} XP
          </span>
        </div>
        <div
          className="goal-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={goalPct}
          aria-label={t("home.goal")}
        >
          <span style={{ width: `${goalPct}%` }} />
        </div>
      </section>

      {progress.due_count > 0 && (
        <button className="card review-card" onClick={onReview}>
          <span className="review-ico">🧠</span>
          <span className="review-text">
            <strong>{t("home.review_title")}</strong>
            <small>{plural(progress.due_count, "home.review_one", "home.review_many", { n: progress.due_count })}</small>
          </span>
          <span className="review-go">{t("home.review_go")}</span>
        </button>
      )}

      <div className="home-grid">
        <button className="tile" onClick={onDictionary}>
          <span className="tile-ico">📖</span>
          <strong>{t("home.tile_dict")}</strong>
          <small>{t("home.tile_dict_sub")}</small>
        </button>
        <button className="tile" onClick={onFlashcards}>
          <span className="tile-ico">🃏</span>
          <strong>{t("home.tile_flash")}</strong>
          <small>
            {progress.deck_count === 0
              ? t("home.tile_deck_empty")
              : plural(progress.deck_count, "home.tile_deck_one", "home.tile_deck_many", { n: progress.deck_count })}
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
                  {totalStars}/{unit.lessons.length * 3} ⭐ · {unit.lessons.length}{" "}
                  {plural(unit.lessons.length, "unit.lesson_one", "unit.lesson_many")}
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
                    aria-label={`${lesson.title}${isDone ? ` · ${starsOf(lesson.id)}/3 ⭐` : ""}${isOpen ? "" : ` · 🔒`}`}
                  >
                    {isOpen ? (isDone ? "✓" : unit.emoji) : "🔒"}
                    {isDone && (
                      <span className="node-stars" aria-hidden="true">
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
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            ref={previewRef}
            role="dialog"
            aria-modal="true"
            aria-label={preview.lesson.title}
          >
            <p className="sheet-emoji">{preview.unit.emoji}</p>
            <h2>{preview.lesson.title}</h2>
            <p className="goal">{preview.lesson.goal}</p>

            <ul className="tips">
              {preview.lesson.tip.map((tip, i) => (
                <li key={i}>💡 {tip}</li>
              ))}
            </ul>

            <p className="sheet-label">{t("home.key_phrases")}</p>
            {preview.lesson.phrases.map((p, i) => (
              <div className="phrase" key={i}>
                <div>
                  <p className="p-es">{p.es}</p>
                  <p className="p-en">{p.t}</p>
                </div>
                <button className="spk" onClick={() => speak(p.t)} aria-label={t("home.listen")}>
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
              {starsOf(preview.lesson.id) > 0 ? t("home.repeat") : t("home.start")} ·{" "}
              {t("home.xp_suffix", { n: preview.lesson.exercises.length * 10 })}
            </button>
          </div>
        </div>
      )}

      {pickOpen && !switching && (
        <div className="overlay" onClick={() => setPickOpen(false)}>
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            ref={pickRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("home.pick_title")}
          >
            <p className="sheet-emoji">🌍</p>
            <h2>{t("home.pick_title")}</h2>
            <p className="goal">{t("home.pick_note")}</p>
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
                    <strong>{targetLangName(l.id)}</strong>
                    <small>{t("home.pick_level", { level: l.level })}</small>
                  </span>
                  {l.id === lang && <span className="lang-row-check">✓</span>}
                </button>
              ))}
            </div>
            <button className="btn big ghost" onClick={() => setPickOpen(false)}>
              {t("home.back")}
            </button>
          </div>
        </div>
      )}

      {switching && switchingLang && (
        <div className="overlay" onClick={onSwitchCancel}>
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            ref={switchRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("home.switch_title", { lang: targetLangName(switchingLang.id) })}
          >
            <p className="sheet-emoji">🌍</p>
            <h2>{t("home.switch_title", { lang: targetLangName(switchingLang.id) })}</h2>
            <p className="goal">
              {t("home.switch_note", { level: switchingLang.level })}
            </p>
            <button className="btn big btn-primary" onClick={onSwitchConfirm}>
              {t("home.switch_go", { lang: `${switchingLang.emoji} ${targetLangName(switchingLang.id)}` })}
            </button>
            <button className="btn big ghost" onClick={onSwitchCancel}>
              {t("home.back")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
