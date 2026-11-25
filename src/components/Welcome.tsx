import { useRef, useState } from "react";
import type { LanguageInfo } from "../types";
import { t, targetLangName, useUiLang } from "../i18n";
import { useSheetFocus } from "../lib/focus";

export default function Welcome({
  langs,
  current,
  onPick,
}: {
  langs: LanguageInfo[];
  current: string;
  onPick: (id: string) => void;
}) {
  useUiLang();
  const ref = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(current);
  useSheetFocus(ref, true, () => {});

  return (
    <div className="overlay">
      <div
        className="sheet welcome"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("w.title")}
      >
        <div className="welcome-emoji"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg></div>
        <h2 className="welcome-title">{t("w.title")}</h2>
        <p className="welcome-text">{t("w.text")}</p>
        <div className="lang-list" role="radiogroup" aria-label={t("w.title")}>
          {langs.map((l) => (
            <button
              key={l.id}
              role="radio"
              aria-checked={selected === l.id}
              className={`lang-row ${selected === l.id ? "current" : ""}`}
              onClick={() => setSelected(l.id)}
            >
              <span className="lang-row-emoji">{l.emoji}</span>
              <span className="lang-row-name"><strong>{targetLangName(l.id)}</strong><small>{l.level}</small></span>
              {selected === l.id && <span className="lang-row-check">✓</span>}
            </button>
          ))}
        </div>
        <button className="btn big btn-primary" onClick={() => onPick(selected)}>
          {t("w.start")}
        </button>
      </div>
    </div>
  );
}
