import { useEffect, useMemo, useRef, useState } from "react";
import type { LanguageInfo, Lesson, ProgressState, Unit } from "../types";
import { setMuted, speak } from "../lib/audio";
import { langOf } from "../lib/langs";
import { plural, targetLangName, t, useUiLang } from "../i18n";
import { useSheetFocus } from "../lib/focus";
import BrandMark from "../components/BrandMark";
import { IconFlame, IconBolt, IconBook, IconCards, IconBrain, IconChart, IconSettings, IconVolume, IconMute, IconCheck, IconLock, IconChevronRight } from "../components/icons";

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
  useSheetFocus(switchRef, switching !== null, onSwitchCancel);

  const starsOf = (id: string) => progress.lessons[id]?.stars ?? 0;

  const isDone = (id: string) => (progress.lessons[id]?.stars ?? 0) > 0;
  const isUnlocked = (unitIdx: number, lessonIdx: number) => {
    if (unitIdx === 0 && lessonIdx === 0) return true;
    if (lessonIdx === 0) {
      const prev = units[unitIdx - 1];
      return isDone(prev.lessons[prev.lessons.length - 1].id);
    }
    return isDone(units[unitIdx].lessons[lessonIdx - 1].id);
  };

  const goalPct = Math.min(100, Math.round((progress.xp_today / progress.daily_goal) * 100));
  const goalDone = progress.xp_today >= progress.daily_goal;

  const firstOpen = useMemo(() => {
    const doneFn = (id: string) => (progress.lessons[id]?.stars ?? 0) > 0;
    const unlockedFn = (unitIdx: number, lessonIdx: number) => {
      if (unitIdx === 0 && lessonIdx === 0) return true;
      if (lessonIdx === 0) {
        const prev = units[unitIdx - 1];
        return doneFn(prev.lessons[prev.lessons.length - 1].id);
      }
      return doneFn(units[unitIdx].lessons[lessonIdx - 1].id);
    };
    for (let ui = 0; ui < units.length; ui++) {
      for (let li = 0; li < units[ui].lessons.length; li++) {
        const lesson = units[ui].lessons[li];
        if ((progress.lessons[lesson.id]?.stars ?? 0) === 0 && unlockedFn(ui, li)) {
          return { unit: units[ui], lesson };
        }
      }
    }
    return null;
  }, [units, progress.lessons]);

  const continueLabel = firstOpen
    ? t("home.start_lesson")
    : progress.due_count > 0
      ? t("home.review_go")
      : t("home.no_left");

  function handleContinue() {
    if (firstOpen) onStart(firstOpen.unit, firstOpen.lesson);
    else if (progress.due_count > 0) onReview();
  }

  const switchingLang = switching ? langs.find((l) => l.id === switching) : null;
  const canContinue = !!firstOpen || progress.due_count > 0;

  return (
    <div className="screen home-v2">
      <header className="topbar">
        <div className="topbar-brand">
          <BrandMark size={36} />
          <div>
            <p className="topbar-name">TuaLingua</p>
            <button className="topbar-lang" onClick={() => setPickOpen(true)} aria-label={t("home.change_lang")}>
              {langOf(lang).emoji} {targetLangName(lang)}
            </button>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="stat-pill" title={t("st.streak")}><IconFlame size={16} /><span>{progress.streak}</span></div>
          <div className="stat-pill" title={t("st.xp_total")}><IconBolt size={16} /><span>{progress.xp}</span></div>
          <button className="icon-circle" onClick={() => setMutedUi((m) => !m)} aria-label={muted ? t("home.unmute") : t("home.mute")}>
            {muted ? <IconMute size={18}/> : <IconVolume size={18}/>} 
          </button>
          <button className="icon-circle" onClick={onStats} aria-label={t("home.stats")}><IconSettings size={18}/></button>
        </div>
      </header>

      <section className="continue-card">
        <div className="continue-main">
          <p className="continue-kicker">{goalDone ? t("home.goal_done") : t("home.start_today")}</p>
          <h1 className="continue-title">
            {firstOpen ? firstOpen.lesson.title : continueLabel}
          </h1>
          <p className="continue-sub">
            {firstOpen
              ? `${firstOpen.unit.emoji} ${firstOpen.unit.title} · ${firstOpen.lesson.goal}`
              : progress.due_count > 0
                ? plural(progress.due_count, "home.review_one", "home.review_many", { n: progress.due_count })
                : t("home.no_left")}
          </p>
          <div className="goal-row">
            <div className="goal-bar hero-goal" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={goalPct} aria-label={t("home.goal")}>
              <span style={{ width: `${goalPct}%` }} />
            </div>
            <span className="goal-text">{progress.xp_today}/{progress.daily_goal} XP</span>
          </div>
        </div>
        <button className="btn btn-primary continue-btn" onClick={handleContinue} disabled={!canContinue}>
          {continueLabel}
        </button>
      </section>

      <div className="action-grid">
        <button className="action-card" onClick={onReview} disabled={progress.due_count === 0}>
          <div className="action-icon"><IconBrain size={20}/></div>
          <div className="action-body">
            <strong>{t("home.review_title")}</strong>
            <span>{progress.due_count > 0 ? plural(progress.due_count, "home.review_one", "home.review_many", { n: progress.due_count }) : "Al día"}</span>
          </div>
        </button>
        <button className="action-card" onClick={onDictionary}>
          <div className="action-icon"><IconBook size={20}/></div>
          <div className="action-body">
            <strong>{t("home.tile_dict")}</strong>
            <span>{t("home.tile_dict_sub")}</span>
          </div>
        </button>
        <button className="action-card" onClick={onFlashcards}>
          <div className="action-icon"><IconCards size={20}/></div>
          <div className="action-body">
            <strong>{t("home.tile_flash")}</strong>
            <span>{progress.deck_count === 0 ? t("home.tile_deck_empty") : plural(progress.deck_count, "home.tile_deck_one", "home.tile_deck_many", { n: progress.deck_count })}</span>
          </div>
        </button>
        <button className="action-card" onClick={onStats}>
          <div className="action-icon"><IconChart size={20}/></div>
          <div className="action-body">
            <strong>{t("home.stats")}</strong>
            <span>Nv {progress.level} · {progress.words_learned} palabras</span>
          </div>
        </button>
      </div>

      <div className="units-list">
        {units.map((unit, ui) => {
          const doneCount = unit.lessons.filter((l) => isDone(l.id)).length;
          const pct = Math.round((doneCount / unit.lessons.length) * 100);
          return (
            <section key={unit.id} className="unit-card">
              <div className="unit-card-head">
                <div className="unit-badge" style={{ background: `${unit.color}22`, color: unit.color }}>{unit.emoji}</div>
                <div className="unit-card-meta">
                  <p className="unit-card-title">{unit.title}</p>
                  <p className="unit-card-sub">{doneCount}/{unit.lessons.length} {plural(unit.lessons.length, "unit.lesson_one", "unit.lesson_many")}</p>
                </div>
                <span className="unit-pct">{pct}%</span>
              </div>
              <div className="unit-progress"><span style={{ width: `${pct}%`, background: unit.color }} /></div>
              <div className="lesson-list">
                {unit.lessons.map((lesson, li) => {
                  const isDoneLesson = isDone(lesson.id);
                  const isOpen = isUnlocked(ui, li);
                  const stars = starsOf(lesson.id);
                  return (
                    <button
                      key={lesson.id}
                      className={`lesson-row ${isDoneLesson ? "done" : ""} ${isOpen ? "open" : "locked"}`}
                      disabled={!isOpen}
                      onClick={() => setPreview({ unit, lesson })}
                    >
                      <div className="lesson-status" style={isDoneLesson ? { background: unit.color, color: "#fff" } : undefined}>
                        {isDoneLesson ? <IconCheck size={16}/> : isOpen ? li + 1 : <IconLock size={15}/>} 
                      </div>
                      <div className="lesson-info">
                        <strong>{lesson.title}</strong>
                        <span>{lesson.goal}</span>
                      </div>
                      <div className="lesson-end">
                        {isDoneLesson ? <span className="lesson-stars">{"★".repeat(stars)}{"☆".repeat(3 - stars)}</span> : isOpen ? <span className="lesson-go"><IconChevronRight size={18}/></span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {preview && (
        <div className="overlay" onClick={() => setPreview(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} ref={previewRef} role="dialog" aria-modal="true" aria-label={preview.lesson.title}>
            <p className="sheet-emoji">{preview.unit.emoji}</p>
            <h2>{preview.lesson.title}</h2>
            <p className="goal">{preview.lesson.goal}</p>
            <ul className="tips">
              {preview.lesson.tip.map((tip, i) => <li key={i}><span className="tip-dot"/> {tip}</li>)}
            </ul>
            <p className="sheet-label">{t("home.key_phrases")}</p>
            {preview.lesson.phrases.map((p, i) => (
              <div className="phrase" key={i}>
                <div>
                  <p className="p-es">{p.es}</p>
                  <p className="p-en">{p.t}</p>
                </div>
                <button className="spk" onClick={() => speak(p.t)} aria-label={t("home.listen")}><IconVolume size={18}/></button>
              </div>
            ))}
            <button className="btn big btn-primary sheet-start" onClick={() => { onStart(preview.unit, preview.lesson); setPreview(null); }}>
              {starsOf(preview.lesson.id) > 0 ? t("home.repeat") : t("home.start")} · {t("home.xp_suffix", { n: preview.lesson.exercises.length * 10 })}
            </button>
          </div>
        </div>
      )}

      {pickOpen && !switching && (
        <div className="overlay" onClick={() => setPickOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} ref={pickRef} role="dialog" aria-modal="true" aria-label={t("home.pick_title")}>
            <div className="sheet-emoji"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg></div>
            <h2>{t("home.pick_title")}</h2>
            <p className="goal">{t("home.pick_note")}</p>
            <div className="lang-list">
              {langs.map((l) => (
                <button key={l.id} className={`lang-row ${l.id === lang ? "current" : ""}`} onClick={() => { setPickOpen(false); if (l.id !== lang) onSwitchPick(l.id); }}>
                  <span className="lang-row-emoji">{l.emoji}</span>
                  <span className="lang-row-name"><strong>{targetLangName(l.id)}</strong><small>{t("home.pick_level", { level: l.level })}</small></span>
                  {l.id === lang && <span className="lang-row-check"><IconCheck size={18}/></span>}
                </button>
              ))}
            </div>
            <button className="btn big ghost" onClick={() => setPickOpen(false)}>{t("home.back")}</button>
          </div>
        </div>
      )}

      {switching && switchingLang && (
        <div className="overlay" onClick={onSwitchCancel}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} ref={switchRef} role="dialog" aria-modal="true" aria-label={t("home.switch_title", { lang: targetLangName(switchingLang.id) })}>
            <div className="sheet-emoji"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg></div>
            <h2>{t("home.switch_title", { lang: targetLangName(switchingLang.id) })}</h2>
            <p className="goal">{t("home.switch_note", { level: switchingLang.level })}</p>
            <button className="btn big btn-primary" onClick={onSwitchConfirm}>
              {t("home.switch_go", { lang: `${switchingLang.emoji} ${targetLangName(switchingLang.id)}` })}
            </button>
            <button className="btn big ghost" onClick={onSwitchCancel}>{t("home.back")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
