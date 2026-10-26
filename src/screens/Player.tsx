import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Exercise, RoundResult } from "../types";
import { sfx, preloadClip, speak, vibrate } from "../lib/audio";
import { normalize, seedOf, shuffled, tokenize } from "../lib/text";
import { randomPraise, targetLangName, t, useUiLang } from "../i18n";
import { useSheetFocus } from "../lib/focus";
import Mascot from "../components/Mascot";

type Info = { answerText?: string; explain?: string; rounds?: RoundResult[]; praise?: string };

function answerOf(ex: Exercise): string | undefined {
  switch (ex.type) {
    case "choice":
    case "listen":
    case "fill":
      return ex.options[ex.answer];
    case "build":
      return ex.solution;
    case "type":
      return ex.solution;
    default:
      return undefined;
  }
}

function useDigitKeys(count: number, enabled: boolean, onDigit: (displayIdx: number) => void) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= count) {
        e.preventDefault();
        onDigit(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, enabled, onDigit]);
}

export default function Player({
  mode,
  lang,
  exercises,
  onExit,
  onFinish,
}: {
  mode: "lesson" | "review" | "flash";
  lang: string;
  exercises: Exercise[];
  onExit: () => void;
  onFinish(
    correct: number,
    total: number,
    comboMax: number,
    rounds: RoundResult[],
  ): void;
}) {
  useUiLang();
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"answer" | "ok" | "ko">("answer");
  const [combo, setCombo] = useState(0);
  const [info, setInfo] = useState<Info>({});
  const [confirmExit, setConfirmExit] = useState(false);
  const exitSheetRef = useRef<HTMLDivElement>(null);
  const correctRef = useRef(0);
  const comboMaxRef = useRef(0);
  const roundsRef = useRef<RoundResult[]>([]);
  const finishedRef = useRef(false);
  const comboRef = useRef(0);
  const defaultPraise = useRef(randomPraise());
  const ex = exercises[idx];

  useSheetFocus(exitSheetRef, confirmExit, () => setConfirmExit(false));

  function speakFor(example: Exercise) {
    if (example.type === "listen") speak(example.audio);
    else if (example.pair) speak(example.pair.t);
  }

  function canReplay(example: Exercise) {
    return example.type === "listen" || !!example.pair;
  }

  const advance = useCallback(() => {
    if (finishedRef.current) return;
    if (idx + 1 >= exercises.length) {
      finishedRef.current = true;
      onFinish(correctRef.current, exercises.length, comboMaxRef.current, roundsRef.current);
    } else {
      setInfo({});
      setPhase("answer");
      setIdx((i) => i + 1);
    }
  }, [idx, exercises.length, onFinish]);

  function handleResult(correct: boolean, extra?: Info) {
    if (phase !== "answer" || finishedRef.current) return;
    setInfo(extra ?? {});
    if (correct) {
      correctRef.current += 1;
      comboRef.current += 1;
      comboMaxRef.current = Math.max(comboMaxRef.current, comboRef.current);
      setCombo(comboRef.current);
      setPhase("ok");
      sfx.correct();
      vibrate(18);
      speakFor(ex);
    } else {
      comboRef.current = 0;
      setCombo(0);
      setPhase("ko");
      sfx.wrong();
      vibrate([28, 70, 28]);
      speakFor(ex);
    }
    const rounds =
      extra?.rounds ?? (ex.pair ? [{ es: ex.pair.es, t: ex.pair.t, correct }] : []);
    roundsRef.current.push(...rounds);
  }

  function requestExit() {
    if (idx > 0 && !finishedRef.current) {
      setConfirmExit(true);
      return;
    }
    onExit();
  }

  function skip() {
    if (phase !== "answer" || finishedRef.current) return;
    handleResult(false, { answerText: answerOf(ex), explain: ex.explain });
  }

  useEffect(() => {
    if (confirmExit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && phase !== "answer" && !finishedRef.current) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, idx, exercises.length, advance, confirmExit]);

  if (!ex) return null;

  const progress = (idx + (phase === "answer" ? 0 : 1)) / exercises.length;

  return (
    <div className="screen player">
      <header className="player-top">
        <button className="icon-btn" onClick={requestExit} aria-label={t("p.exit")}>
          ✕
        </button>
        <div
          className="pbar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label={mode === "review" ? t("p.review_icon") : `${idx + 1}/${exercises.length}`}
        >
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        {combo >= 2 ? (
          <div className="combo" key={combo} aria-live="polite">
            ×{combo} 🔥
          </div>
        ) : (
          <div className="combo ghost">
            {mode === "review" ? "🧠" : `${idx + 1}/${exercises.length}`}
          </div>
        )}
      </header>

      <div className={`ex-wrap ${phase === "ko" ? "shake" : ""}`} key={ex.id}>
        <p className="prompt">{ex.prompt}</p>
        {ex.type === "choice" && (
          <ChoiceExercise ex={ex} locked={phase !== "answer"} onResult={handleResult} />
        )}
        {ex.type === "listen" && (
          <ListenExercise ex={ex} locked={phase !== "answer"} onResult={handleResult} />
        )}
        {ex.type === "build" && (
          <BuildExercise ex={ex} locked={phase !== "answer"} onResult={handleResult} />
        )}
        {ex.type === "match" && <MatchExercise ex={ex} onResult={handleResult} />}
        {ex.type === "type" && (
          <TypeExercise ex={ex} lang={lang} locked={phase !== "answer"} onResult={handleResult} />
        )}
        {ex.type === "fill" && (
          <FillExercise ex={ex} locked={phase !== "answer"} onResult={handleResult} />
        )}
      </div>

      {phase === "answer" && ex.type !== "match" && !confirmExit && (
        <button className="skip-btn" onClick={skip}>
          {t("p.skip")}
        </button>
      )}

      {phase !== "answer" && (
        <footer className={`feedback ${phase === "ok" ? "good" : "bad"}`}>
          <div className="fb-row">
            <Mascot mood={phase === "ok" ? "happy" : "sad"} size={56} />
            <div className="fb-text">
              <strong>{phase === "ok" ? info.praise ?? defaultPraise.current : t("p.ko")}</strong>
              {phase === "ko" && info.answerText && (
                <p className="fb-answer">{info.answerText}</p>
              )}
              {info.explain && <p className="fb-explain">{info.explain}</p>}
            </div>
            {canReplay(ex) && (
              <button
                className="spk fb-spk"
                onClick={() => speakFor(ex)}
                aria-label={t("p.listen_again")}
              >
                🔊
              </button>
            )}
          </div>
          <button
            className={`btn big ${phase === "ok" ? "btn-good" : "btn-bad"}`}
            onClick={advance}
          >
            {t("p.continue")}
          </button>
        </footer>
      )}

      {confirmExit && (
        <div className="overlay" onClick={() => setConfirmExit(false)}>
          <div
            className="sheet"
            onClick={(e) => e.stopPropagation()}
            ref={exitSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("p.exit_title")}
          >
            <p className="sheet-emoji">🚪</p>
            <h2>{t("p.exit_title")}</h2>
            <p className="goal">{t("p.exit_note")}</p>
            <button className="btn big btn-primary" onClick={() => setConfirmExit(false)}>
              {t("p.exit_no")}
            </button>
            <button className="btn big danger-btn" onClick={onExit}>
              {t("p.exit_yes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChoiceExercise({
  ex,
  locked,
  onResult,
}: {
  ex: Extract<Exercise, { type: "choice" }>;
  locked: boolean;
  onResult: (correct: boolean, info?: Info) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const praise = useRef(randomPraise());
  const order = useMemo(
    () => shuffled(ex.options.map((_, i) => i), seedOf(ex.id)),
    [ex.id, ex.options],
  );

  function pick(oi: number) {
    setPicked(oi);
    sfx.tap();
    onResult(oi === ex.answer, {
      answerText: ex.options[ex.answer],
      explain: ex.explain,
      praise: praise.current,
    });
  }

  useDigitKeys(order.length, !locked && picked === null, (n) => pick(order[n]));

  return (
    <div className="opts">
      {order.map((oi) => {
        let cls = "";
        if (picked !== null) {
          if (oi === ex.answer) cls = "correct";
          else if (picked === oi) cls = "wrong";
          else cls = "dim";
        }
        return (
          <button
            key={oi}
            className={`opt ${cls}`}
            disabled={locked || picked !== null}
            onClick={() => pick(oi)}
          >
            {ex.options[oi]}
          </button>
        );
      })}
    </div>
  );
}

function ListenExercise({
  ex,
  locked,
  onResult,
}: {
  ex: Extract<Exercise, { type: "listen" }>;
  locked: boolean;
  onResult: (correct: boolean, info?: Info) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const praise = useRef(randomPraise());
  const order = useMemo(
    () => shuffled(ex.options.map((_, i) => i), seedOf(ex.id)),
    [ex.id, ex.options],
  );
  useEffect(() => {
    preloadClip(ex.audio);
    const timer = window.setTimeout(() => speak(ex.audio), 420);
    return () => clearTimeout(timer);
  }, [ex.id, ex.audio]);

  function pick(oi: number) {
    setPicked(oi);
    sfx.tap();
    onResult(oi === ex.answer, {
      answerText: ex.options[ex.answer],
      explain: ex.explain,
      praise: praise.current,
    });
  }

  useDigitKeys(order.length, !locked && picked === null, (n) => pick(order[n]));

  return (
    <>
      <div className="audio-row">
        <button className="btn audio" onClick={() => speak(ex.audio)} aria-label={t("p.listen")}>
          🔊
        </button>
        <button className="btn audio" onClick={() => speak(ex.audio, 0.6)} aria-label={t("p.listen_slow")}>
          🐢
        </button>
      </div>
      <div className="opts">
        {order.map((oi) => {
          let cls = "";
          if (picked !== null) {
            if (oi === ex.answer) cls = "correct";
            else if (picked === oi) cls = "wrong";
            else cls = "dim";
          }
          return (
            <button
              key={oi}
              className={`opt ${cls}`}
              disabled={locked || picked !== null}
              onClick={() => pick(oi)}
            >
              {ex.options[oi]}
            </button>
          );
        })}
      </div>
    </>
  );
}

function BuildExercise({
  ex,
  locked,
  onResult,
}: {
  ex: Extract<Exercise, { type: "build" }>;
  locked: boolean;
  onResult: (correct: boolean, info?: Info) => void;
}) {
  const praise = useRef(randomPraise());
  const [chosen, setChosen] = useState<string[]>([]);
  const tokens = useMemo(() => {
    const all = [...tokenize(ex.solution), ...ex.distractors];
    return shuffled(
      all.map((text, i) => ({ id: `t${i}`, text })),
      seedOf(ex.id),
    );
  }, [ex.id, ex.solution, ex.distractors]);

  const bank = tokens.filter((tk) => !chosen.includes(tk.id));
  const textOf = (id: string) => tokens.find((tk) => tk.id === id)?.text ?? "";

  const check = useCallback(() => {
    const value = chosen
      .map((id) => tokens.find((tk) => tk.id === id)?.text ?? "")
      .join(" ");
    const ok = normalize(value) === normalize(ex.solution);
    onResult(ok, {
      answerText: ex.solution,
      explain: ex.explain,
      praise: praise.current,
    });
  }, [chosen, ex.solution, ex.explain, tokens, onResult]);

  useEffect(() => {
    if (locked || chosen.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, chosen.length, check]);

  return (
    <>
      <div className={`build-area ${chosen.length ? "has" : ""}`}>
        {chosen.length === 0 && <span className="build-hint">{t("p.build_hint")}</span>}
        {chosen.map((id) => (
          <button
            key={id}
            className="chip chosen"
            disabled={locked}
            onClick={() => {
              if (locked) return;
              setChosen((c) => c.filter((x) => x !== id));
              sfx.tap();
            }}
          >
            {textOf(id)}
          </button>
        ))}
      </div>
      <div className="bank">
        {bank.map((tk) => (
          <button
            key={tk.id}
            className="chip"
            disabled={locked}
            onClick={() => {
              if (locked) return;
              setChosen((c) => [...c, tk.id]);
              sfx.tap();
            }}
          >
            {tk.text}
          </button>
        ))}
      </div>
      <button className="btn big btn-primary" disabled={locked || chosen.length === 0} onClick={check}>
        {t("p.check")}
      </button>
    </>
  );
}

function MatchExercise({
  ex,
  onResult,
}: {
  ex: Extract<Exercise, { type: "match" }>;
  onResult: (correct: boolean, info?: Info) => void;
}) {
  const praise = useRef(randomPraise());
  const left = useMemo(
    () => shuffled(ex.pairs.map((p, i) => ({ ...p, i })), seedOf(ex.id + "L")),
    [ex.id, ex.pairs],
  );
  const right = useMemo(
    () => shuffled(ex.pairs.map((p, i) => ({ ...p, i })), seedOf(ex.id + "R")),
    [ex.id, ex.pairs],
  );
  const [selL, setSelL] = useState<number | null>(null);
  const [selR, setSelR] = useState<number | null>(null);
  const [matched, setMatched] = useState<number[]>([]);
  const [shake, setShake] = useState(false);
  const errorsRef = useRef(0);
  const wrongRef = useRef<string[]>([]);
  const doneRef = useRef(false);

  useEffect(() => {
    if (selL === null || selR === null || doneRef.current) return;
    if (selL === selR) {
      const next = [...matched, selL];
      setMatched(next);
      setSelL(null);
      setSelR(null);
      sfx.tap();
      vibrate(12);
      if (next.length === ex.pairs.length) {
        doneRef.current = true;
        const ok = errorsRef.current === 0;
        const answerText = ex.pairs
          .filter((p) => wrongRef.current.includes(p.es))
          .map((p) => `${p.es} = ${p.t}`)
          .join(" · ");
        window.setTimeout(
          () =>
            onResult(ok, {
              answerText: ok ? undefined : answerText,
              rounds: ex.pairs.map((p) => ({
                es: p.es,
                t: p.t,
                correct: !wrongRef.current.includes(p.es),
              })),
              praise: praise.current,
            }),
          420,
        );
      }
    } else {
      errorsRef.current += 1;
      wrongRef.current.push(ex.pairs[selL].es, ex.pairs[selR].es);
      setShake(true);
      sfx.wrong();
      vibrate(20);
      window.setTimeout(() => {
        setShake(false);
        setSelL(null);
        setSelR(null);
      }, 480);
    }
  }, [selL, selR, matched, ex.pairs, onResult]);

  return (
    <div className={`match ${shake ? "shake" : ""}`}>
      <div className="col">
        {left.map((p) => (
          <button
            key={`l${p.i}`}
            className={`chip match-chip ${matched.includes(p.i) ? "done" : selL === p.i ? "sel" : ""}`}
            disabled={matched.includes(p.i) || doneRef.current}
            onClick={() => {
              setSelL(p.i);
              sfx.tap();
            }}
          >
            {p.es}
          </button>
        ))}
      </div>
      <div className="col">
        {right.map((p) => (
          <button
            key={`r${p.i}`}
            className={`chip match-chip ${matched.includes(p.i) ? "done" : selR === p.i ? "sel" : ""}`}
            disabled={matched.includes(p.i) || doneRef.current}
            onClick={() => {
              setSelR(p.i);
              sfx.tap();
            }}
          >
            {p.t}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypeExercise({
  ex,
  lang,
  locked,
  onResult,
}: {
  ex: Extract<Exercise, { type: "type" }>;
  lang: string;
  locked: boolean;
  onResult: (correct: boolean, info?: Info) => void;
}) {
  const praise = useRef(randomPraise());
  const [value, setValue] = useState("");

  function check() {
    const typed = normalize(value);
    const ok =
      typed.length > 0 &&
      (ex.accept.some((a) => normalize(a) === typed) || normalize(ex.solution) === typed);
    onResult(ok, {
      answerText: ex.solution,
      explain: ex.explain,
      praise: praise.current,
    });
  }

  return (
    <form
      className="type-area"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked) check();
      }}
    >
      <input
        className="type-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("p.type_placeholder", { lang: targetLangName(lang) })}
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        disabled={locked}
      />
      <button className="btn big btn-primary" type="submit" disabled={locked || !value.trim()}>
        {t("p.check")}
      </button>
    </form>
  );
}

function FillExercise({
  ex,
  locked,
  onResult,
}: {
  ex: Extract<Exercise, { type: "fill" }>;
  locked: boolean;
  onResult: (correct: boolean, info?: Info) => void;
}) {
  const praise = useRef(randomPraise());
  const [picked, setPicked] = useState<number | null>(null);
  const parts = ex.sentence.split("___");
  const order = useMemo(
    () => shuffled(ex.options.map((_, i) => i), seedOf(ex.id)),
    [ex.id, ex.options],
  );

  function pick(oi: number) {
    setPicked(oi);
    sfx.tap();
    window.setTimeout(
      () =>
        onResult(oi === ex.answer, {
          answerText: ex.options[ex.answer],
          explain: ex.explain,
          praise: praise.current,
        }),
      340,
    );
  }

  useDigitKeys(order.length, !locked && picked === null, (n) => pick(order[n]));

  return (
    <>
      <p className="sentence">
        {parts[0]}
        <span className={`blank ${picked !== null ? "filled" : ""}`}>
          {picked !== null ? ex.options[picked] : "…"}
        </span>
        {parts[1]}
      </p>
      <div className="opts">
        {order.map((oi) => {
          let cls = "";
          if (picked !== null) {
            if (oi === ex.answer) cls = "correct";
            else if (picked === oi) cls = "wrong";
            else cls = "dim";
          }
          return (
            <button
              key={oi}
              className={`opt ${cls}`}
              disabled={locked || picked !== null}
              onClick={() => pick(oi)}
            >
              {ex.options[oi]}
            </button>
          );
        })}
      </div>
    </>
  );
}
