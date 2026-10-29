import { describe, expect, it } from "vitest";

import {
  CONTROL_EVENT_IDS,
  defaultControlFile,
  readControlKeys,
  writeControlKeys,
} from "./controlBinary";

describe("controlBinary", () => {
  const file = defaultControlFile();

  it("le fichier d'origine a 24 actions au clavier, avec les touches d'origine", () => {
    const keys = readControlKeys(file);
    expect(keys.size).toBe(24);
    expect(keys.get(CONTROL_EVENT_IDS.forward)).toBe(0x11); // W
    expect(keys.get(CONTROL_EVENT_IDS.jump)).toBe(0x39); // Espace
    expect(keys.get(CONTROL_EVENT_IDS.sprint)).toBe(0x38); // Alt gauche
    expect(keys.get(CONTROL_EVENT_IDS.quickload)).toBe(0x43); // F9
    expect(Object.keys(CONTROL_EVENT_IDS)).toHaveLength(24);
    expect([...keys.keys()].sort()).toEqual(Object.values(CONTROL_EVENT_IDS).sort());
  });

  it("change une touche, retrie les enregistrements et ne touche pas au reste", () => {
    const next = writeControlKeys(file, new Map([[CONTROL_EVENT_IDS.jump, 0x22]]));
    expect(next.length).toBe(file.length);
    expect(readControlKeys(next).get(CONTROL_EVENT_IDS.jump)).toBe(0x22);
    const keysInOrder = Array.from({ length: 24 }, (_, i) => next[12 + i * 5]);
    expect(keysInOrder).toEqual([...keysInOrder].sort((a, b) => a - b));
    // en-tête, sections souris et manette : identiques
    expect(next.subarray(0, 12)).toEqual(file.subarray(0, 12));
    expect(next.subarray(12 + 24 * 5)).toEqual(file.subarray(12 + 24 * 5));
    // les autres actions gardent leur touche
    const before = readControlKeys(file);
    const after = readControlKeys(next);
    for (const [id, key] of before)
      if (id !== CONTROL_EVENT_IDS.jump) expect(after.get(id)).toBe(key);
  });

  it("reproduit exactement le fichier écrit par le jeu pour Sauter sur H", () => {
    const next = writeControlKeys(file, new Map([[CONTROL_EVENT_IDS.jump, 0x23]]));
    expect(readControlKeys(next).get(CONTROL_EVENT_IDS.jump)).toBe(0x23);
    expect(next[12 + 13 * 5]).toBe(0x23); // H passe entre F (0x21) et J (0x24)
  });

  it("échange deux touches sans perdre d'action", () => {
    const next = writeControlKeys(
      file,
      new Map([
        [CONTROL_EVENT_IDS.forward, 0x1f],
        [CONTROL_EVENT_IDS.back, 0x11],
      ]),
    );
    const keys = readControlKeys(next);
    expect(keys.get(CONTROL_EVENT_IDS.forward)).toBe(0x1f);
    expect(keys.get(CONTROL_EVENT_IDS.back)).toBe(0x11);
  });

  it("refuse deux actions sur la même touche, une action inconnue et un fichier invalide", () => {
    expect(() => writeControlKeys(file, new Map([[CONTROL_EVENT_IDS.jump, 0x11]]))).toThrow();
    expect(() => writeControlKeys(file, new Map([[0x7f, 0x22]]))).toThrow();
    expect(() => readControlKeys(Buffer.from("// texte"))).toThrow();
    expect(() => readControlKeys(Buffer.alloc(40))).toThrow();
  });
});
