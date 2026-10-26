import { describe, expect, it } from "vitest";
import { mulberry32, normalize, seedOf, shuffled, tokenize } from "./text";

describe("normalize", () => {
  it("minúsculas sin acentos ni puntuación", () => {
    expect(normalize("¿Hola, PRINGADO?")).toBe("hola pringado");
    expect(normalize("¡I'm Hungry!")).toBe("im hungry");
    expect(normalize("  café   con leche.. ")).toBe("cafe con leche");
    expect(normalize("«don't»")).toBe("dont");
  });

  it("mantiene dígitos y símbolos simples", () => {
    expect(normalize("I am 20 years old")).toBe("i am 20 years old");
  });

  it("funciona con texto ruso", () => {
    expect(normalize("Привет, КАК дела?")).toBe("привет как дела");
    expect(normalize("Всё плохо?!")).toBe("все плохо");
    expect(normalize("спасибо!")).toBe("спасибо");
  });
});

describe("seedOf", () => {
  it("es estable para el mismo texto", () => {
    expect(seedOf("u5l1e2")).toBe(seedOf("u5l1e2"));
    expect(seedOf("a")).not.toBe(seedOf("b"));
  });
});

describe("shuffled", () => {
  it("es determinista con la misma semilla", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffled(items, seedOf("x"))).toEqual(shuffled(items, seedOf("x")));
  });

  it("permuta sin perder elementos", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(items, 42);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
  });

  it("no muta el array de entrada", () => {
    const items = [1, 2, 3];
    shuffled(items, 7);
    expect(items).toEqual([1, 2, 3]);
  });
});

describe("mulberry32", () => {
  it("misma semilla ⇒ misma secuencia", () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
  });

  it("devuelve valores en [0,1)", () => {
    const a = mulberry32(1);
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("tokenize", () => {
  it("divide por espacios y recorta", () => {
    expect(tokenize("  I   worked late ")).toEqual(["I", "worked", "late"]);
    expect(tokenize("")).toEqual([""]);
    expect(tokenize("one")).toEqual(["one"]);
  });
});
