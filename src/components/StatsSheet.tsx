import { useEffect, useRef, useState } from "react";
import type { ProgressState, SrsCard, Unit } from "../types";
import type { AudioMode } from "../lib/audio";
import { ttsAvailable } from "../lib/audio";
import { plural, setUiLang, UI_LANGS, levelTitle, uiLang, t, useUiLang } from "../i18n";
import { useSheetFocus } from "../lib/focus";
import { IconFlame, IconBolt, IconTrophy, IconTarget, IconBook, IconBrain, IconClock } from "../components/icons";

const CAL_WEEKS = 13;
const CAL_DAYS = CAL_WEEKS * 7;
const GOAL_MIN = 10;
const GOAL_MAX = 300;
const GOAL_STEP = 10;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Theme = "auto" | "light" | "dark";

/** Camino de la línea de XP de los últimos días (viewBox 0–100). */
function xpChartPoints(history: { day: string; xp: number }[]): string {
  if (history.length === 0) return "";
  const max = Math.max(1, ...history.map((h) => h.xp));
  const n = history.length;
  return history
    .map((h, i) => {
      const x = (n === 1 ? 0.5 : i / (n - 1)) * 100;
      const y = 100 - (h.xp / max) * 100;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function calendarCells(history: { day: string; xp: number }[], goal: number) {
  const byDay = new Map(history.map((h) => [h.day, h.xp]));
  const cells: { day: string; xp: number; lvl: number }[] = [];
  for (let i = CAL_DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const day = isoDay(d);
    const xp = byDay.get(day) ?? 0;
    const lvl = xp === 0 ? 0 : xp >= goal ? 4 : xp >= (goal * 2) / 3 ? 3 : xp >= goal / 3 ? 2 : 1;
    cells.push({ day, xp, lvl });
  }
  return cells;
}

export default function StatsSheet({
  units,
  progress,
  dueSoon,
  audioMode,
  onAudioMode,
  onClose,
  onReset,
  onDailyGoal,
  onExport,
  onImport,
}: {
  units: Unit[];
  progress: ProgressState;
  dueSoon: SrsCard[] | null;
  audioMode: AudioMode;
  onAudioMode: (mode: AudioMode) => void;
  onClose: () => void;
  onReset: () => Promise<void>;
  onDailyGoal: (goal: number) => Promise<boolean> | void;
  onExport: () => Promise<boolean>;
  onImport: () => Promise<boolean>;
}) {
  useUiLang();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [goal, setGoal] = useState(progress.daily_goal);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [uiSelect, setUiSelect] = useState<ReturnType<typeof uiLang>>(uiLang());
  const [theme, setTheme] = useState<Theme>(() => {
    const v = localStorage.getItem("tl-theme");
    return v === "light" || v === "dark" ? v : "auto";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme === "auto" ? "" : theme;
    localStorage.setItem("tl-theme", theme);
  }, [theme]);

  useSheetFocus(sheetRef, true, onClose);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const accuracy =
    progress.total_answers > 0
      ? Math.round((progress.total_correct / progress.total_answers) * 100)
      : 0;
  const levelPct = Math.min(100, Math.round((progress.level_xp / progress.level_needed) * 100));
  const lessonsDone = Object.values(progress.lessons).filter((l) => l.stars > 0).length;

  async function reset() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
      setConfirming(false);
      onClose();
    }
  }

  async function applyGoal(next: number) {
    const clamped = Math.max(GOAL_MIN, Math.min(GOAL_MAX, next));
    setGoal(clamped);
    if (clamped !== progress.daily_goal) await onDailyGoal(clamped);
  }

  async function doExport() {
    setBusy("export");
    try {
      const ok = await onExport();
      setToast(ok ? t("st.export_ok") : t("st.export_fail"));
    } catch {
      setToast(t("st.export_fail"));
    } finally {
      setBusy(null);
    }
  }

  async function doImport() {
    setBusy("import");
    try {
      const ok = await onImport();
      if (ok) {
        setToast(t("st.import_ok"));
      } else {
        setToast(t("st.import_fail"));
      }
      setBusy(null);
      if (ok) onClose();
      return;
    } catch {
      setToast(t("st.import_fail"));
    }
    setBusy(null);
  }

  const cells = calendarCells(progress.history, progress.daily_goal);
  const dueList = dueSoon ?? [];

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet"
        onClick={(e) => e.stopPropagation()}
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("st.title")}
      >
        <h2>{t("st.title")}</h2>

        <div className="level-card">
          <div className="level-top">
            <span className="level-badge">{t("st.level_short", { n: progress.level })}</span>
            <strong>{levelTitle(progress.level)}</strong>
            <span className="level-xp">
              {progress.level_xp}/{progress.level_needed} XP
            </span>
          </div>
          <div
            className="goal-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={levelPct}
            aria-label={levelTitle(progress.level)}
          >
            <span style={{ width: `${levelPct}%` }} />
          </div>
        </div>

        {progress.history.length > 0 && (
          <div className="xp-chart">
            <p className="xp-chart-label">{t("st.xp_trend")}</p>
            <svg className="xp-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polyline
                fill="none"
                stroke="#8E6FFF"
                strokeWidth="4"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={xpChartPoints(progress.history)}
              />
            </svg>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat">
            <b><IconBolt size={15}/> {progress.xp}</b>
            <span>{t("st.xp_total")}</span>
          </div>
          <div className="stat">
            <b><IconFlame size={15}/> {progress.streak}</b>
            <span>{t("st.streak")}</span>
          </div>
          <div className="stat">
            <b><IconTrophy size={15}/> {progress.best_streak}</b>
            <span>{t("st.best_streak")}</span>
          </div>
          <div className="stat">
            <b><IconTarget size={15}/> {accuracy}%</b>
            <span>{t("st.accuracy")}</span>
          </div>
          <div className="stat">
            <b><IconBook size={15}/> {progress.words_learned}</b>
            <span>{t("st.words")}</span>
          </div>
          <div className="stat">
            <b><IconBrain size={15}/> {progress.due_count}</b>
            <span>{t("st.due")}</span>
          </div>
          <div className="stat">
            <b><IconClock size={15}/> {lessonsDone}</b>
            <span>{t("st.total_lessons")}</span>
          </div>
        </div>

        {toast && <p className="sheet-toast" aria-live="polite">{toast}</p>}

        <p className="sheet-label">{t("st.settings")}</p>
        <div className="set-grid">
          <div className="set-row">
            <span className="set-name">{t("st.daily_goal")}</span>
            <div className="set-ctl">
              <button
                className="step-btn"
                disabled={goal <= GOAL_MIN || resetting}
                onClick={() => void applyGoal(goal - GOAL_STEP)}
                aria-label={`${t("st.daily_goal")} −${GOAL_STEP}`}
              >
                −
              </button>
              <strong className="set-val">{goal}</strong>
              <button
                className="step-btn"
                disabled={goal >= GOAL_MAX || resetting}
                onClick={() => void applyGoal(goal + GOAL_STEP)}
                aria-label={`${t("st.daily_goal")} +${GOAL_STEP}`}
              >
                +
              </button>
            </div>
          </div>
          <div className="set-row">
            <span className="set-name">{t("st.ui_lang")}</span>
            <div className="set-ctl" role="radiogroup" aria-label={t("st.ui_lang")}>
              {UI_LANGS.map((l) => (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={uiSelect === l.id}
                  className={`step-btn aux ${uiSelect === l.id ? "on" : ""}`}
                  onClick={() => {
                    setUiSelect(l.id);
                    setUiLang(l.id);
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          <div className="set-row">
            <span className="set-name">{t("st.theme")}</span>
            <div className="set-ctl theme-toggle">
              {(["auto", "light", "dark"] as const).map((tid) => (
                <button
                  key={tid}
                  className={`step-btn aux ${theme === tid ? "on" : ""}`}
                  aria-pressed={theme === tid}
                  onClick={() => setTheme(tid)}
                >
                  {t(`st.theme_${tid}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <span className="set-name">{t("st.audio_mode")}</span>
            <div className="set-ctl theme-toggle">
              {(["clip", "tts"] as const).map((mid) => (
                <button
                  key={mid}
                  className={`step-btn aux ${audioMode === mid ? "on" : ""}`}
                  aria-pressed={audioMode === mid}
                  onClick={() => onAudioMode(mid)}
                  disabled={mid === "tts" && !ttsAvailable()}
                  title={mid === "tts" && !ttsAvailable() ? t("st.tts_unavailable") : undefined}
                >
                  {t(`st.audio_${mid}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="set-row">
            <span className="set-name">{t("st.export")} / {t("st.import")}</span>
            <div className="set-ctl">
              <button className="step-btn aux" disabled={busy !== null} onClick={() => void doExport()}>
                {busy === "export" ? "…" : "⬆"}
              </button>
              <button className="step-btn aux" disabled={busy !== null} onClick={() => void doImport()}>
                {busy === "import" ? "…" : "⬇"}
              </button>
            </div>
          </div>
        </div>

        <p className="sheet-label">{t("st.calendar")}</p>
        <div className="cal" role="img" aria-label={t("st.calendar_hint")}>
          {cells.map((c) => (
            <i
              key={c.day}
              className={`cal-cell lvl${c.lvl}`}
              title={`${c.day} · ${c.xp} XP`}
            />
          ))}
        </div>
        <div className="cal-legend">
          {[0, 1, 2, 3, 4].map((l) => (
            <i key={l} className={`cal-cell lvl${l}`} />
          ))}
          <span>{t("st.cal_legend")}</span>
        </div>
        <p className="sheet-hint">{t("st.calendar_hint")}</p>

        <p className="sheet-label">
          {t("st.due_soon")}
          {dueSoon !== null && (
            <small>
              {" · "}
              {plural(progress.due_count, "home.review_one", "home.review_many", { n: progress.due_count })}
            </small>
          )}
        </p>
        {dueSoon === null ? (
          <div className="dots sm">
            <i />
            <i />
            <i />
          </div>
        ) : dueList.length === 0 ? (
          <p className="sheet-hint">{t("st.due_soon_empty")}</p>
        ) : (
          <ul className="due-list">
            {dueList.map((c) => (
              <li key={`${c.es}|${c.t}`}>
                <span className="due-es">{c.es}</span>
                <b>→</b>
                <span className="due-t">{c.t}</span>
                <small className="due-reps">×{c.reps}</small>
              </li>
            ))}
          </ul>
        )}

        <p className="sheet-label">{t("st.units")}</p>
        {units.map((unit) => {
          const doneCount = unit.lessons.filter(
            (l) => (progress.lessons[l.id]?.stars ?? 0) > 0,
          ).length;
          const pct = Math.round((doneCount / unit.lessons.length) * 100);
          return (
            <div className="unit-row" key={unit.id}>
              <span className="unit-row-emoji">{unit.emoji}</span>
              <div className="unit-row-body">
                <div className="unit-row-top">
                  <strong>{unit.title}</strong>
                  <span>
                    {doneCount}/{unit.lessons.length}
                  </span>
                </div>
                <div
                  className="ubar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label={`${unit.title} · ${doneCount}/${unit.lessons.length}`}
                >
                  <span style={{ width: `${pct}%`, background: unit.color }} />
                </div>
              </div>
            </div>
          );
        })}

        <button className="btn big danger-btn" onClick={reset} disabled={resetting}>
          {confirming ? t("st.confirm") : t("st.reset")}
        </button>
        <button className="btn big ghost" onClick={onClose}>
          {t("st.close")}
        </button>
      </div>
    </div>
  );
}
