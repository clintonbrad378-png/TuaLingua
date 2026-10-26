import { describe, expect, it } from "vitest";
import { buildFlashExercises, FLASH_BATCH, buildReview, poolOf } from "./api";
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
            ? [{ id: `${lessonId}c`, type: "choice" as const, prompt: "p", options: [pairPhrase.t, "cat"], answer: 0, pair: pairPhrase }]
            : []),
        ],
      },
    ],
  };
}

describe("poolOf", () => {
  it("deduplica por texto y mezcla frases/pairs/match", () => {
    const units: Unit[] = [
      unitWith("l1", [{ es: "hola", t: "hello" }], [{ es: "adiós", t: "goodbye" }], {
        es: "hi",
        t: "hello",
      }),
      unitWith("l2", [{ es: "¿cómo estás?", t: "Goodbye" }]),
    ];
    const pool = poolOf(units);
    expect(pool.map((p) => p.t.toLowerCase()).sort()).toEqual(["goodbye", "hello"]);
  });
});

describe("buildReview", () => {
  const cards = [
    { es: "hola", t: "привет", due: "2026-01-01", reps: 3 },
    { es: "adiós", t: "до свидания", due: "2026-01-02", reps: 1 },
    { es: "gracias", t: "спасибо", due: "2026-01-03", reps: 2 },
  ];
  const pool: Phrase[] = [
    { es: "hola", t: "привет" },
    { es: "adiós", t: "до свидания" },
    { es: "gracias", t: "спасибо" },
    { es: "gato", t: "кот" },
    { es: "perro", t: "собака" },
  ];
  const exercises = buildReview(cards, pool, "ru");

  it("crea un ejercicio por tarjeta con ids únicos", () => {
    expect(exercises).toHaveLength(cards.length);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(cards.length);
  });

  it("la primera asigna tipo choice con respuesta correcta", () => {
    const ex = exercises[0];
    if (ex.type !== "choice") throw new Error("la primera es choice");
    expect(ex.options[ex.answer]).toBe(ex.pair?.t);
    expect(ex.options).toHaveLength(4);
    const distractors = ex.options.filter((_, i) => i !== ex.answer);
    expect(distractors).not.toContain(ex.pair?.t);
  });

  it("los tipo exigen escribir el texto del idioma", () => {
    const ex = exercises[1];
    if (ex.type !== "type") throw new Error("la segunda es type");
    expect(ex.accept).toContain(ex.pair!.t.toLowerCase());
    expect(ex.solution).toBe(ex.pair!.t);
    expect(ex.prompt).toBe(`Escribe en Ruso: «${ex.pair!.es}»`);
  });

  it("las de escucha incluyen la traducción correcta", () => {
    const ex = exercises[2];
    if (ex.type !== "listen") throw new Error("la tercera es listen");
    expect(ex.options[ex.answer]).toBe(ex.pair?.es);
    expect(ex.audio).toBe(ex.pair?.t);
  });

  it("no rompe con pool mínimo", () => {
    const tiny = buildReview(
      [{ es: "a", t: "b", due: "2026-01-01", reps: 1 }],
      [{ es: "a", t: "b" }],
      "ru",
    );
    expect(tiny).toHaveLength(1);
  });

  it("resuelve la card contra el pool canonico (case-insensitive)", () => {
    const pool: Phrase[] = [
      { es: "Hola", t: "Привет" },
      { es: "Adios", t: "До свидания" },
      { es: "Gracias", t: "Спасибо" },
    ];
    const cards = [
      { es: "hola", t: "привет", due: "2026-01-01", reps: 1 },
      { es: "adios", t: "до свидания", due: "2026-01-01", reps: 1 },
      { es: "gracias", t: "спасибо", due: "2026-01-01", reps: 1 },
    ];
    const exercises = buildReview(cards, pool, "ru");
    const choice = exercises[0];
    if (choice.type !== "choice") throw new Error("esperaba choice");
    expect(choice.pair?.t).toBe("Привет");
    expect(choice.options[choice.answer]).toBe("Привет");
    const type = exercises[1];
    if (type.type !== "type") throw new Error("esperaba type");
    expect(type.pair?.es).toBe("Adios");
    expect(type.solution).toBe("До свидания");
    const listen = exercises[2];
    if (listen.type !== "listen") throw new Error("esperaba listen");
    expect(listen.pair?.t).toBe("Спасибо");
    expect(listen.audio).toBe("Спасибо");
    expect(listen.options[listen.answer]).toBe("Gracias");
  });
});

describe("buildFlashExercises", () => {
  const deck: Phrase[] = [
    { es: "perro", t: "пёс" },
    { es: "gato", t: "кот" },
    { es: "manzana", t: "яблоко" },
    { es: "amarillo", t: "жёлтый" },
    { es: "familia", t: "семья" },
    { es: "cocinar", t: "готовить" },
  ];
  const pool: Phrase[] = [
    ...deck,
    { es: "gracias", t: "спасибо" },
    { es: "perdon", t: "извини" },
    { es: "sal", t: "соль" },
    { es: "pan", t: "хлеб" },
    { es: "quepa", t: "окно" },
  ];

  it("genera un ejercicio por palabra del mazo con ids únicos", () => {
    const exercises = buildFlashExercises(deck, pool, "ru");
    expect(exercises).toHaveLength(deck.length);
    expect(new Set(exercises.map((e) => e.id)).size).toBe(deck.length);
    for (const ex of exercises) {
      expect(ex.pair).toBeDefined();
    }
  });

  it("limita el lote al máximo FLASH_BATCH", () => {
    const big: Phrase[] = [];
    for (let i = 0; i < FLASH_BATCH + 20; i++) {
      big.push({ es: `es-${i}`, t: `t-${i}` });
    }
    const giantPool = [...big, ...pool];
    const exercises = buildFlashExercises(big, giantPool, "ru");
    expect(exercises).toHaveLength(FLASH_BATCH);
    const ids = new Set(exercises.map((e) => e.id));
    expect(ids.size).toBe(FLASH_BATCH);
  });

  it("las de elección incluyen distractores distintos de la respuesta", () => {
    const exercises = buildFlashExercises(deck, pool, "ru");
    const choices = exercises.filter((e) => e.type === "choice") as Extract<
      (typeof exercises)[number],
      { type: "choice" }
    >[];
    expect(choices.length).toBeGreaterThan(0);
    for (const ex of choices) {
      expect(ex.options).toHaveLength(4);
      expect(new Set(ex.options).size).toBe(4);
      expect(ex.options[ex.answer]).toBe(ex.pair?.t);
    }
  });

  it("los de escritura piden el texto del mazo", () => {
    const exercises = buildFlashExercises(deck, pool, "ru");
    const types = exercises.filter((e) => e.type === "type") as Extract<
      (typeof exercises)[number],
      { type: "type" }
    >[];
    expect(types.length).toBeGreaterThan(0);
    for (const ex of types) {
      expect(ex.accept).toContain(ex.pair!.t.toLowerCase());
      expect(ex.prompt.startsWith("Escribe en Ruso: «")).toBe(true);
    }
  });

  it("cada ejercicio lleva su pair del mazo", () => {
    const exercises = buildFlashExercises(deck, pool, "ru");
    const deckKeys = new Set(deck.map((p) => p.t.toLowerCase()));
    for (const ex of exercises) {
      expect(deckKeys.has(ex.pair!.t.toLowerCase())).toBe(true);
    }
  });

  it("no rompe con un mazo de una sola palabra", () => {
    const tiny = buildFlashExercises([{ es: "a", t: "b" }], [
      { es: "a", t: "b" },
      { es: "x", t: "y" },
    ], "ru");
    expect(tiny).toHaveLength(1);
  });
});
