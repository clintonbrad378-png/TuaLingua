import { useRef } from "react";
import { t, useUiLang } from "../i18n";
import { useSheetFocus } from "../lib/focus";

export default function Welcome({ onClose }: { onClose: () => void }) {
  useUiLang();
  const ref = useRef<HTMLDivElement>(null);
  useSheetFocus(ref, true, onClose);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="sheet welcome"
        onClick={(e) => e.stopPropagation()}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("w.title")}
      >
        <div className="welcome-emoji"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
        <h2 className="welcome-title">{t("w.title")}</h2>
        <p className="welcome-text">{t("w.text")}</p>
        <button className="btn big btn-primary" onClick={onClose}>
          {t("w.start")}
        </button>
      </div>
    </div>
  );
}
