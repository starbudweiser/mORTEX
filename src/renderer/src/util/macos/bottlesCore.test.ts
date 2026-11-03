import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { addBottleRoot, configureBottles, listBottles, readState } from "./bottlesCore";

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
