import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  isolateDocuments,
  MARKER,
  restoreSharedDocuments,
  sharedDocumentsTarget,
} from "./bottleDocuments";

// une « bouteille » dont Documents pointe vers un faux ~/Documents, comme CrossOver
describe("bottle Documents", () => {
  let tmp: string;
  let macDocs: string;
  let documents: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-docs-"));
    macDocs = path.join(tmp, "MacDocuments");
    const game = path.join(macDocs, "My Games", "Skyrim Special Edition");
    fs.mkdirSync(path.join(game, "Saves"), { recursive: true });
    fs.writeFileSync(path.join(game, "Skyrim.ini"), "[General]\n");
    fs.writeFileSync(path.join(game, "Saves", "save1.ess"), "save");
    fs.mkdirSync(path.join(macDocs, "My Games", "GTA V"), { recursive: true });
    fs.writeFileSync(path.join(macDocs, "letter.txt"), "personal");
    const userDir = path.join(tmp, "bottle", "drive_c", "users", "crossover");
    fs.mkdirSync(userDir, { recursive: true });
    documents = path.join(userDir, "Documents");
    fs.symlinkSync(macDocs, documents);
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("sees that the bottle shares the Mac's Documents", async () => {
    expect(await sharedDocumentsTarget(documents)).toBe(macDocs);
  });

  it("isolates the game's folder and leaves the Mac's Documents alone", async () => {
    await isolateDocuments(documents, ["Skyrim Special Edition"]);

    expect(fs.lstatSync(documents).isSymbolicLink()).toBe(false);
    expect(await sharedDocumentsTarget(documents)).toBeUndefined();
    const ini = path.join(documents, "My Games", "Skyrim Special Edition", "Skyrim.ini");
    expect(fs.readFileSync(ini, "utf8")).toBe("[General]\n");
    expect(fs.existsSync(path.join(documents, "My Games", "GTA V"))).toBe(false);
    expect(fs.existsSync(path.join(documents, "letter.txt"))).toBe(false);

    // une modification dans la bouteille ne touche plus la copie du Mac
    fs.writeFileSync(ini, "[General]\nchanged\n");
    const macIni = path.join(macDocs, "My Games", "Skyrim Special Edition", "Skyrim.ini");
    expect(fs.readFileSync(macIni, "utf8")).toBe("[General]\n");
  });

  it("can be undone, keeping the isolated folder aside", async () => {
    await isolateDocuments(documents, ["Skyrim Special Edition"]);
    const kept = await restoreSharedDocuments(documents);

    expect(await sharedDocumentsTarget(documents)).toBe(macDocs);
    expect(fs.existsSync(path.join(kept, MARKER))).toBe(true);
    expect(fs.existsSync(path.join(kept, "My Games", "Skyrim Special Edition", "Saves"))).toBe(
      true,
    );
  });

  it("keeps both copies when isolating and undoing twice", async () => {
    await isolateDocuments(documents, ["Skyrim Special Edition"]);
    const first = await restoreSharedDocuments(documents);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await isolateDocuments(documents, ["Skyrim Special Edition"]);
    const second = await restoreSharedDocuments(documents);

    expect(second).not.toBe(first);
    expect(fs.existsSync(first) && fs.existsSync(second)).toBe(true);
  });

  it("refuses a Documents folder that is already the bottle's own", async () => {
    await isolateDocuments(documents, ["Skyrim Special Edition"]);
    await expect(isolateDocuments(documents, ["Skyrim Special Edition"])).rejects.toThrow();
  });
});
