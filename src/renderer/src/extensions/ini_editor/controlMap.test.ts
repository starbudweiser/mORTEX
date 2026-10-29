import { describe, expect, it } from "vitest";

import {
  changedEvents,
  eventsUsingKey,
  findConflicts,
  findEvent,
  formatKeySlot,
  keyCombos,
  parseControlMap,
  parseKeySlot,
  serializeControlMap,
  withKeyboard,
} from "./controlMap";
import { dikFromEventCode, dikName, macKeyName } from "./dikKeys";

// table de démonstration au format du jeu (écrite pour les tests, pas une copie du fichier de Bethesda)
const T = "\t";
const SAMPLE = [
  "// exemple de table",
  "//",
  "// Gameplay",
  `Forward${T}${T}${T}0x11${T}0xff${T}0xff${T}1${T}1${T}0${T}0x801`,
  `Back${T}${T}${T}${T}0x1f${T}0xff${T}0xff${T}1${T}1${T}0${T}0x801`,
  `Jump${T}${T}${T}0x39${T}0xff${T}0xff${T}1${T}1${T}1`,
  `Hotkey1${T}${T}0x02,0x4f${T}0xff${T}0xff${T}0${T}0${T}0`,
  `Shot${T}${T}${T}0x1d+0xb7,0x9d+0xb7${T}0xff${T}0xff${T}0${T}0${T}0`,
  `Console${T}${T}0x29${T}0xff${T}0xff${T}0${T}0${T}0${T}0x10`,
  `${T}${T}${T}`,
  "// Menus",
  `Accept${T}${T}!0,Activate${T}${T}!0,Activate${T}0x1000${T}0${T}0${T}0${T}0x8`,
  `Console${T}${T}0x29${T}0xff${T}0xff${T}0${T}0${T}0`,
  `Free${T}${T}${T}0xff${T}0xff${T}0xff${T}1${T}1${T}0`,
  "",
].join("\r\n");

describe("controlMap", () => {
  const map = parseControlMap(SAMPLE);

  it("reconnaît les contextes, leurs titres et les événements", () => {
    expect(map.eol).toBe("\r\n");
    expect(map.contexts.map((c) => c.title)).toEqual(["Gameplay", "Menus"]);
    expect(map.contexts[0].events.map((e) => e.name)).toEqual([
      "Forward",
      "Back",
      "Jump",
      "Hotkey1",
      "Shot",
      "Console",
    ]);
    expect(map.contexts[1].events.map((e) => e.name)).toEqual(["Accept", "Console", "Free"]);
  });

  it("lit le champ clavier et le drapeau remappable", () => {
    expect(findEvent(map, 0, "forward")).toMatchObject({ keyboard: "0x11", remappable: true });
    expect(findEvent(map, 0, "Hotkey1")).toMatchObject({
      keyboard: "0x02,0x4f",
      remappable: false,
    });
  });

  it("relit à l'identique ce qu'il a lu", () => {
    expect(serializeControlMap(map)).toBe(SAMPLE);
    const lf = SAMPLE.replace(/\r\n/g, "\n");
    expect(serializeControlMap(parseControlMap(lf))).toBe(lf);
  });

  it("analyse les formes du champ clavier", () => {
    expect(parseKeySlot("0xff")).toEqual({ kind: "unmapped" });
    expect(parseKeySlot("0x11")).toEqual({ kind: "keys", combos: [[0x11]] });
    expect(parseKeySlot("0x02,0x4f")).toEqual({ kind: "keys", combos: [[0x02], [0x4f]] });
    expect(parseKeySlot("0x1d+0xb7,0x9d+0xb7")).toEqual({
      kind: "keys",
      combos: [
        [0x1d, 0xb7],
        [0x9d, 0xb7],
      ],
    });
    expect(parseKeySlot("!0,Activate")).toEqual({ kind: "alias", text: "!0,Activate" });
  });

  it("écrit le champ clavier : 0xff quand il n'y a plus de touche", () => {
    expect(formatKeySlot([])).toBe("0xff");
    expect(formatKeySlot([[0x2a, 0x11]])).toBe("0x2a+0x11");
    expect(formatKeySlot([[0x02], [0x4f]])).toBe("0x02,0x4f");
  });

  it("ne change que le champ clavier de la ligne visée", () => {
    const next = withKeyboard(map, 0, "Forward", [[0x48]]);
    const before = SAMPLE.split("\r\n");
    const after = serializeControlMap(next).split("\r\n");
    expect(after).toHaveLength(before.length);
    before.forEach((line, i) => {
      if (i === findEvent(map, 0, "Forward")?.line)
        expect(after[i]).toBe(line.replace("0x11", "0x48"));
      else expect(after[i]).toBe(line);
    });
    expect(findEvent(next, 0, "Forward")?.keyboard).toBe("0x48");
  });

  it("distingue deux événements de même nom dans deux contextes", () => {
    const next = withKeyboard(map, 1, "Console", [[0x3b]]);
    expect(findEvent(next, 0, "Console")?.keyboard).toBe("0x29");
    expect(findEvent(next, 1, "Console")?.keyboard).toBe("0x3b");
  });

  it("libère une touche", () => {
    expect(findEvent(withKeyboard(map, 0, "Jump", []), 0, "Jump")?.keyboard).toBe("0xff");
  });

  it("refuse un événement inconnu", () => {
    expect(() => withKeyboard(map, 0, "Nope", [[1]])).toThrow();
  });

  it("signale les touches partagées dans un même contexte, pas entre contextes", () => {
    expect(findConflicts(map)).toEqual([]);
    const clash = withKeyboard(map, 0, "Back", [[0x11]]);
    expect(findConflicts(clash)).toEqual([
      { context: 0, combo: [0x11], events: ["Forward", "Back"] },
    ]);
  });

  it("une combinaison n'est pas en conflit avec sa touche seule", () => {
    const next = withKeyboard(map, 0, "Back", [[0x1d]]);
    expect(findConflicts(next)).toEqual([]);
  });

  it("trouve les événements qui utilisent une touche", () => {
    expect(eventsUsingKey(map, 0xb7).map((u) => u.name)).toEqual(["Shot"]);
    expect(eventsUsingKey(map, 0x29).map((u) => `${u.context}:${u.name}`)).toEqual([
      "0:Console",
      "1:Console",
    ]);
  });

  it("liste les événements modifiés par rapport à une table de base", () => {
    const next = withKeyboard(withKeyboard(map, 0, "Jump", [[0x2a]]), 0, "Back", []);
    expect(changedEvents(map, next)).toEqual([
      { context: 0, name: "Back", before: "0x1f", after: "0xff" },
      { context: 0, name: "Jump", before: "0x39", after: "0x2a" },
    ]);
    expect(changedEvents(map, map)).toEqual([]);
  });

  it("rend les combinaisons d'un événement", () => {
    expect(keyCombos(findEvent(map, 0, "Hotkey1")!)).toEqual([[0x02], [0x4f]]);
    expect(keyCombos(findEvent(map, 1, "Accept")!)).toEqual([]);
  });
});

describe("dikKeys", () => {
  it("nomme les touches comme le jeu", () => {
    expect(dikName(0x11)).toBe("W");
    expect(dikName(0x39)).toBe("Space");
    expect(dikName(0x29)).toBe("`");
    expect(dikName(0x3b)).toBe("F1");
    expect(dikName(0x4f)).toBe("Num 1");
    expect(dikName(0xee)).toBe("0xee");
  });

  it("met les symboles Mac sur les touches de modification", () => {
    expect(macKeyName(0x38)).toBe("⌥ Option");
    expect(macKeyName(0xdb)).toBe("⌘ Commande");
    expect(macKeyName(0x11)).toBe("W");
  });

  it("passe de la position physique d'une touche au code du jeu", () => {
    expect(dikFromEventCode("KeyW")).toBe(0x11);
    expect(dikFromEventCode("Digit1")).toBe(0x02);
    expect(dikFromEventCode("Backquote")).toBe(0x29);
    expect(dikFromEventCode("AltLeft")).toBe(0x38);
    expect(dikFromEventCode("MetaLeft")).toBe(0xdb);
    expect(dikFromEventCode("Numpad0")).toBe(0x52);
    expect(dikFromEventCode("MediaPlayPause")).toBeUndefined();
  });
});
