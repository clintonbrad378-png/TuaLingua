import { useEffect, useMemo, useRef, useState } from "react";
import type { Exercise, RoundResult } from "../types";
import { sfx, preloadClip, speak, vibrate } from "../lib/audio";
import { normalize, seedOf, shuffled, tokenize } from "../lib/text";
import Mascot from "../components/Mascot";

type Info = { answerText?: string; explain?: string; rounds?: RoundResult[]; praise?: string };

const PRAISES = ["¡Perfecto!", "¡Genial!", "¡Muy bien!", "¡Exacto!", "¡Así se hace!", "¡Eres un crack!"];

export default function Player({
  mode,
  exercises,
  onExit,
  onFinish,
}: {
  mode: "lesson" | "review";
  exercises: Exercise[];
  onExit: () => void;
  onFinish: (
    correct: number,
    total: number,
    comboMax: number,
    rounds: RoundResult[],
  ) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"answer" | "ok" | "ko">("answer");
  const [combo, setCombo] = useState(0);
  const [info, setInfo] = useState<Info>({});
  const correctRef = useRef(0);
  const comboMaxRef = useRef(0);
  const roundsRef = useRef<RoundResult[]>([]);
  const finishedRef = useRef(false);
  const comboRef = useRef(0);
  const ex = exercises[idx];

  function speakFor(example: Exercise) {
    if (example.type === "listen") speak(example.audio);
    else if (example.pair) speak(example.pair.en);
  }

  function canReplay(example: Exercise) {
    return example.type === "listen" || !!example.pair;
  }

  function advance() {
    if (finishedRef.current) return;
    if (idx + 1 >= exercises.length) {
      finishedRef.current = true;
      onFinish(correctRef.current, exercises.length, comboMaxRef.current, roundsRef.current);
    } else {
      setInfo({});
      setPhase("answer");
      setIdx((i) => i + 1);
    }
  }

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
      extra?.rounds ?? (ex.pair ? [{ es: ex.pair.es, en: ex.pair.en, correct }] : []);
    roundsRef.current.push(...rounds);
  }

  function exit() {
    if (idx > 0 && !finishedRef.current) {
      if (!window.confirm("¿Salir? Perderás el progreso de esta sesión.")) return;
    }
    onExit();
  }

  if (!ex) return null;

  const progress = (idx + (phase === "answer" ? 0 : 1)) / exercises.length;

  return (
    <div className="screen player">
      <header className="player-top">
        <button className="icon-btn" onClick={exit} aria-label="Salir">
          ✕
        </button>
        <div className="pbar">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        {combo >= 2 ? (
          <div className="combo" key={combo}>
            ×{combo} 🔥
          </div>
        ) : (
          <div className="combo ghost">{mode === "review" ? "🧠" : `${idx + 1}/${exercises.length}`}</div>
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
          <TypeExercise ex={ex} locked={phase !== "answer"} onResult={handleResult} />
        )}
        {ex.type === "fill" && (
          <FillExercise ex={ex} locked={phase !== "answer"} onResult={handleResult} />
        )}
      </div>

      {phase !== "answer" && (
        <footer className={`feedback ${phase === "ok" ? "good" : "bad"}`}>
          <div className="fb-row">
            <Mascot mood={phase === "ok" ? "happy" : "sad"} size={56} />
            <div className="fb-text">
              <strong>{phase === "ok" ? info.praise ?? PRAISES[0] : "Casi…"}</strong>
              {phase === "ko" && info.answerText && (
                <p className="fb-answer">{info.answerText}</p>
              )}
              {info.explain && <p className="fb-explain">{info.explain}</p>}
            </div>
            {canReplay(ex) && (
              <button
                className="spk fb-spk"
                onClick={() => speakFor(ex)}
                aria-label="Escuchar de nuevo"
              >
                🔊
              </button>
            )}
          </div>
          <button
            className={`btn big ${phase === "ok" ? "btn-good" : "btn-bad"}`}
            onClick={advance}
          >
            Continuar
          </button>
        </footer>
      )}
    </div>
  );
}

function praiseOnce() {
  return PRAISES[Math.floor(Math.random() * PRAISES.length)];
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
  const praise = useRef(praiseOnce());
  const order = useMemo(
    () => shuffled(ex.options.map((_, i) => i), seedOf(ex.id)),
    [ex.id, ex.options],
  );
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
            onClick={() => {
              setPicked(oi);
              sfx.tap();
              const ok = oi === ex.answer;
              onResult(ok, {
                answerText: ex.options[ex.answer],
                explain: ex.explain,
                praise: praise.current,
              });
            }}
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
  const praise = useRef(praiseOnce());
  const order = useMemo(
    () => shuffled(ex.options.map((_, i) => i), seedOf(ex.id)),
    [ex.id, ex.options],
  );
  useEffect(() => {
    preloadClip(ex.audio);
    const t = window.setTimeout(() => speak(ex.audio), 420);
    return () => clearTimeout(t);
  }, [ex.id, ex.audio]);
  return (
    <>
      <div className="audio-row">
        <button className="btn audio" onClick={() => speak(ex.audio)} aria-label="Escuchar">
          🔊
        </button>
        <button className="btn audio" onClick={() => speak(ex.audio, 0.6)} aria-label="Escuchar despacio">
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
              onClick={() => {
                setPicked(oi);
                sfx.tap();
                onResult(oi === ex.answer, {
                  answerText: ex.options[ex.answer],
                  explain: ex.explain,
                  praise: praise.current,
                });
              }}
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
  const praise = useRef(praiseOnce());
  const [chosen, setChosen] = useState<string[]>([]);
  const tokens = useMemo(() => {
    const all = [...tokenize(ex.solution), ...ex.distractors];
    return shuffled(
      all.map((text, i) => ({ id: `t${i}`, text })),
      seedOf(ex.id),
    );
  }, [ex.id, ex.solution, ex.distractors]);

  const bank = tokens.filter((t) => !chosen.includes(t.id));
  const textOf = (id: string) => tokens.find((t) => t.id === id)?.text ?? "";

  function check() {
    const value = chosen.map(textOf).join(" ");
    const ok = normalize(value) === normalize(ex.solution);
    onResult(ok, {
      answerText: ex.solution,
      explain: ex.explain,
      praise: praise.current,
    });
  }

  return (
    <>
      <div className={`build-area ${chosen.length ? "has" : ""}`}>
        {chosen.length === 0 && <span className="build-hint">Toca las palabras en orden…</span>}
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
        {bank.map((t) => (
          <button
            key={t.id}
            className="chip"
            disabled={locked}
            onClick={() => {
              if (locked) return;
              setChosen((c) => [...c, t.id]);
              sfx.tap();
            }}
          >
            {t.text}
          </button>
        ))}
      </div>
      <button className="btn big btn-primary" disabled={locked || chosen.length === 0} onClick={check}>
        Comprobar
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
  const praise = useRef(praiseOnce());
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
          .map((p) => `${p.es} = ${p.en}`)
          .join(" · ");
        window.setTimeout(
          () =>
            onResult(ok, {
              answerText: ok ? undefined : answerText,
              rounds: ex.pairs.map((p) => ({
                es: p.es,
                en: p.en,
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
            {p.en}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypeExercise({
  ex,
  locked,
  onResult,
}: {
  ex: Extract<Exercise, { type: "type" }>;
  locked: boolean;
  onResult: (correct: boolean, info?: Info) => void;
}) {
  const praise = useRef(praiseOnce());
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
        placeholder="Escribe en inglés…"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        disabled={locked}
      />
      <button className="btn big btn-primary" type="submit" disabled={locked || !value.trim()}>
        Comprobar
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
  const praise = useRef(praiseOnce());
  const [picked, setPicked] = useState<number | null>(null);
  const parts = ex.sentence.split("___");
  const order = useMemo(
    () => shuffled(ex.options.map((_, i) => i), seedOf(ex.id)),
    [ex.id, ex.options],
  );
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
              onClick={() => {
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
              }}
            >
              {ex.options[oi]}
            </button>
          );
        })}
      </div>
    </>
  );
}
