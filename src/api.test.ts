import { describe, expect, it } from "vitest";
import { buildReview, poolOf } from "./api";
import type { Phrase, Unit } from "./types";

function unitWith(lessonId: string, phrases: Phrase[], matchPairs?: Phrase[], pairPhrase?: Phrase): Unit {
  return {
    id: "u1",
    title: "T",
    emoji: "🙂",
    color: "#000000",
    lessons: [
      {
        id: lessonId,
        title: "L",
        goal: "G",
        tip: [],
        phrases,
        exercises: [
          ...(matchPairs
            ? [{ id: `${lessonId}m`, type: "match" as const, prompt: "p", pairs: matchPairs }]
            : []),
          ...(pairPhrase
            ? [{ id: `${lessonId}c`, type: "choice" as const, prompt: "p", options: [pairPhrase.en, "cat"], answer: 0, pair: pairPhrase }]
            : []),
        ],
      },
    ],
  };
}

describe("poolOf", () => {
  it("deduplica por texto EN y mezcla frases/pairs/match", () => {
    const units: Unit[] = [
      unitWith("l1", [{ es: "hola", en: "hello" }], [{ es: "adiós", en: "goodbye" }], {
        es: "hi",
        en: "hello",
      }),
      unitWith("l2", [{ es: "¿cómo estás?", en: "Goodbye" }]),
    ];
    const pool = poolOf(units);
    expect(pool.map((p) => p.en.toLowerCase()).sort()).toEqual(["goodbye", "hello"]);
  });
});

describe("buildReview", () => {
  const cards = [
    { es: "hola", en: "hello", due: "2026-01-01", reps: 3 },
    { es: "adiós", en: "goodbye", due: "2026-01-02", reps: 1 },
    { es: "gracias", en: "thank you", due: "2026-01-03", reps: 2 },
  ];
  const pool: Phrase[] = [
    { es: "hola", en: "hello" },
    { es: "adiós", en: "goodbye" },
    { es: "gracias", en: "thank you" },
    { es: "gato", en: "cat" },
    { es: "perro", en: "dog" },
  ];
  const exercises = buildReview(cards, pool);

  it("crea un ejercicio por tarjeta con ids únicos", () => {
    expect(exercises).toHaveLength(cards.length);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(cards.length);
  });

  it("la variable response asigna tipo choice con respuesta correcta", () => {
    const ex = exercises[0];
    if (ex.type !== "choice") throw new Error("la primera t es choice");
    expect(ex.options[ex.answer]).toBe(ex.pair?.en);
    expect(ex.options).toHaveLength(4);
    const distractors = ex.options.filter((_, i) => i !== ex.answer);
    expect(distractors).not.toContain(ex.pair?.en);
  });

  it("los tipo exigen escribir el EN de la tarjeta", () => {
    const ex = exercises[1];
    if (ex.type !== "type") throw new Error("la segunda es type");
    expect(ex.accept).toContain(ex.pair!.en.toLowerCase());
    expect(ex.solution).toBe(ex.pair!.en);
  });

  it("las de escucha incluyen la traducción correcta", () => {
    const ex = exercises[2];
    if (ex.type !== "listen") throw new Error("la tercera es listen");
    expect(ex.options[ex.answer]).toBe(ex.pair?.es);
    expect(ex.audio).toBe(ex.pair?.en);
  });

  it("no rompe con pool mínimo", () => {
    const tiny = buildReview(
      [{ es: "a", en: "b", due: "2026-01-01", reps: 1 }],
      [{ es: "a", en: "b" }],
    );
    expect(tiny).toHaveLength(1);
  });

  it("resuelve la card contra el pool canonico (case-insensitive)", () => {
    const pool: Phrase[] = [
      { es: "Hola", en: "Hello" },
      { es: "Adios", en: "Goodbye" },
      { es: "Gracias", en: "Thank you" },
    ];
    const cards = [
      { es: "hola", en: "hello", due: "2026-01-01", reps: 1 },
      { es: "adios", en: "goodbye", due: "2026-01-01", reps: 1 },
      { es: "gracias", en: "thank you", due: "2026-01-01", reps: 1 },
    ];
    const exercises = buildReview(cards, pool);
    const choice = exercises[0];
    if (choice.type !== "choice") throw new Error("esperaba choice");
    expect(choice.pair?.en).toBe("Hello");
    expect(choice.options[choice.answer]).toBe("Hello");
    const type = exercises[1];
    if (type.type !== "type") throw new Error("esperaba type");
    expect(type.pair?.es).toBe("Adios");
    expect(type.solution).toBe("Goodbye");
    const listen = exercises[2];
    if (listen.type !== "listen") throw new Error("esperaba listen");
    expect(listen.pair?.en).toBe("Thank you");
    expect(listen.audio).toBe("Thank you");
    expect(listen.options[listen.answer]).toBe("Gracias");
  });
});
