import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { addBottleRoot, configureBottles, listBottles, readState, wineEnv } from "./bottlesCore";

describe("état injecté", () => {
  it("écrit les dossiers de bouteilles dans le fichier d'état choisi et les retrouve", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bottles-core-"));
    const root = path.join(dir, "roots");
    const bottle = path.join(root, "b1");
    fs.mkdirSync(path.join(bottle, "drive_c"), { recursive: true });
    fs.writeFileSync(path.join(bottle, "system.reg"), "");
    configureBottles({ statePath: () => path.join(dir, "state", "bottles.json") });

    addBottleRoot(root);
    addBottleRoot(root);

    expect(readState().roots).toEqual([root]);
    expect(listBottles().map((b) => b.path)).toContain(bottle);
  });

  it("journalise l'échec d'écriture dans le journal injecté, sans lever d'erreur", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bottles-core-"));
    const blocker = path.join(dir, "fichier");
    fs.writeFileSync(blocker, "");
    const log = vi.fn();
    configureBottles({ statePath: () => path.join(blocker, "bottles.json"), log });

    expect(() => addBottleRoot("/x")).not.toThrow();
    expect(log).toHaveBeenCalledWith("warn", "could not write bottles.json", expect.anything());
  });
});

describe("wineEnv", () => {
  const saved = process.env.LC_CTYPE;
  afterEach(() => {
    if (saved === undefined) delete process.env.LC_CTYPE;
    else process.env.LC_CTYPE = saved;
  });

  it("retire le LC_CTYPE de secours que Python pose, pour que wine garde la langue de la bouteille", () => {
    process.env.LC_CTYPE = "C.UTF-8";
    expect(wineEnv().LC_CTYPE).toBeUndefined();
    expect(wineEnv({ CX_BOTTLE_PATH: "/b" }).CX_BOTTLE_PATH).toBe("/b");
  });

  it("garde une vraie langue choisie par l'utilisateur", () => {
    process.env.LC_CTYPE = "fr_FR.UTF-8";
    expect(wineEnv().LC_CTYPE).toBe("fr_FR.UTF-8");
    expect(wineEnv({ LC_CTYPE: "en_US.UTF-8" }).LC_CTYPE).toBe("en_US.UTF-8");
  });
});
