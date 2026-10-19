import { useState } from "react";
import type { ProgressState, Unit } from "../types";

export default function StatsSheet({
  units,
  progress,
  onClose,
  onReset,
}: {
  units: Unit[];
  progress: ProgressState;
  onClose: () => void;
  onReset: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  const accuracy =
    progress.total_answers > 0
      ? Math.round((progress.total_correct / progress.total_answers) * 100)
      : 0;
  const levelPct = Math.min(100, Math.round((progress.level_xp / progress.level_needed) * 100));

  async function reset() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setResetting(true);
    await onReset();
    setResetting(false);
    setConfirming(false);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Tu progreso</h2>

        <div className="level-card">
          <div className="level-top">
            <span className="level-badge">Nv {progress.level}</span>
            <strong>{progress.level_title}</strong>
            <span className="level-xp">
              {progress.level_xp}/{progress.level_needed} XP
            </span>
          </div>
          <div className="goal-bar">
            <span style={{ width: `${levelPct}%` }} />
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat">
            <b>⚡ {progress.xp}</b>
            <span>XP total</span>
          </div>
          <div className="stat">
            <b>🔥 {progress.streak}</b>
            <span>Racha actual</span>
          </div>
          <div className="stat">
            <b>🏆 {progress.best_streak}</b>
            <span>Mejor racha</span>
          </div>
          <div className="stat">
            <b>🎯 {accuracy}%</b>
            <span>Precisión</span>
          </div>
          <div className="stat">
            <b>📚 {progress.words_learned}</b>
            <span>Palabras aprendidas</span>
          </div>
          <div className="stat">
            <b>🧠 {progress.due_count}</b>
            <span>Por repasar</span>
          </div>
        </div>

        <p className="sheet-label">Unidades</p>
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
                <div className="ubar">
                  <span style={{ width: `${pct}%`, background: unit.color }} />
                </div>
              </div>
            </div>
          );
        })}

        <button className="btn big danger-btn" onClick={reset} disabled={resetting}>
          {confirming ? "¿Seguro? Toca otra vez" : "Reiniciar progreso"}
        </button>
        <button className="btn big ghost" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
