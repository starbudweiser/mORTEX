import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { restoreBackup } from "./backup";
import { readFromBsa } from "./bsaRead";
import { findEvent, parseControlMap, serializeControlMap, withKeyboard } from "./controlMap";
import { CUSTOM_NAME, commitControlsSave, loadControls, planControlsSave } from "./controls";

const T = "\t";
const BASE = [
  "// Gameplay",
  `Forward${T}${T}0x11${T}0xff${T}0xff${T}1${T}1${T}0`,
  `Jump${T}${T}0x39${T}0xff${T}0xff${T}1${T}1${T}1`,
  "",
  "// Menus",
  `Console${T}${T}0x29${T}0xff${T}0xff${T}0${T}0${T}0`,
  "",
].join("\r\n");

/** archive BSA v105 non compressée avec un seul dossier, construite pour les tests */
function buildBsa(folder: string, files: Array<{ name: string; data: Buffer }>): Buffer {
  const folderNames = Buffer.from(`${folder}\0`, "latin1");
  const names = files.map((f) => Buffer.from(`${f.name}\0`, "latin1"));
  const fileNamesLength = names.reduce((n, b) => n + b.length, 0);
  const blockStart = 36 + 24;
  const blockSize = 1 + folderNames.length + 16 * files.length;
  const dataStart = blockStart + blockSize + fileNamesLength;

  const header = Buffer.alloc(36);
  header.write("BSA\0", 0, "latin1");
  header.writeUInt32LE(105, 4);
  header.writeUInt32LE(36, 8);
  header.writeUInt32LE(0x3, 12);
  header.writeUInt32LE(1, 16);
  header.writeUInt32LE(files.length, 20);
  header.writeUInt32LE(folderNames.length, 24);
  header.writeUInt32LE(fileNamesLength, 28);

  const record = Buffer.alloc(24);
  record.writeUInt32LE(files.length, 8);
  record.writeBigUInt64LE(BigInt(blockStart + fileNamesLength), 16);

  const block = Buffer.alloc(blockSize);
  block[0] = folderNames.length;
  folderNames.copy(block, 1);
  let offset = dataStart;
  files.forEach((f, i) => {
    const at = 1 + folderNames.length + 16 * i;
    block.writeUInt32LE(f.data.length, at + 8);
    block.writeUInt32LE(offset, at + 12);
    offset += f.data.length;
  });
  return Buffer.concat([header, record, block, ...names, ...files.map((f) => f.data)]);
}

describe("bsaRead", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "mortex-bsa-"));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it("lit un fichier d'une archive, sans tenir compte de la casse", async () => {
    const bsa = path.join(dir, "Skyrim - Interface.bsa");
    await writeFile(
      bsa,
      buildBsa("interface\\controls\\pc", [
        { name: "gamepad.txt", data: Buffer.from("pad") },
        { name: "controlmap.txt", data: Buffer.from(BASE, "latin1") },
      ]),
    );
    const data = await readFromBsa(bsa, "Interface\\Controls\\PC\\ControlMap.txt");
    expect(data?.toString("latin1")).toBe(BASE);
    expect((await readFromBsa(bsa, "interface\\controls\\pc\\gamepad.txt"))?.toString()).toBe(
      "pad",
    );
    expect(await readFromBsa(bsa, "interface\\nope.txt")).toBeUndefined();
  });

  it("refuse un fichier qui n'est pas une archive", async () => {
    const bad = path.join(dir, "x.bsa");
    await writeFile(bad, Buffer.alloc(64));
    await expect(readFromBsa(bad, "a.txt")).rejects.toThrow();
  });
});

describe("controls", () => {
  let root: string;
  let game: string;
  let iniDir: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "mortex-controls-"));
    game = path.join(root, "game");
    iniDir = path.join(root, "My Games");
    await mkdir(path.join(game, "Data"), { recursive: true });
    await mkdir(iniDir, { recursive: true });
    await writeFile(
      path.join(game, "Data", "Skyrim - Interface.bsa"),
      buildBsa("interface\\controls\\pc", [
        { name: "controlmap.txt", data: Buffer.from(BASE, "latin1") },
      ]),
    );
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it("charge la table de l'archive quand il n'y a pas de fichier libre ni de fichier personnel", async () => {
    const loaded = await loadControls(game, iniDir);
    expect(loaded.source).toBe("Skyrim - Interface.bsa");
    expect(loaded.customExists).toBe(false);
    expect(serializeControlMap(loaded.base)).toBe(BASE);
    expect(loaded.current).toBe(loaded.base);
  });

  it("préfère le fichier libre d'un mod à l'archive", async () => {
    const loose = path.join(game, "Data", "Interface", "Controls", "PC");
    await mkdir(loose, { recursive: true });
    await writeFile(path.join(loose, "controlmap.txt"), BASE.replace("0x11", "0x48"));
    const loaded = await loadControls(game, iniDir);
    expect(loaded.source).toBe(path.join(loose, "controlmap.txt"));
    expect(findEvent(loaded.base, 0, "Forward")?.keyboard).toBe("0x48");
  });

  it("applique le fichier personnel par-dessus la base, complet ou partiel", async () => {
    const edited = withKeyboard(parseControlMap(BASE), 0, "Jump", [[0x2a]]);
    await writeFile(path.join(iniDir, CUSTOM_NAME), serializeControlMap(edited));
    let loaded = await loadControls(game, iniDir);
    expect(loaded.customExists).toBe(true);
    expect(findEvent(loaded.current, 0, "Jump")?.keyboard).toBe("0x2a");
    expect(findEvent(loaded.base, 0, "Jump")?.keyboard).toBe("0x39");

    const partial = ["// Menus", `Console${T}${T}0x3b${T}0xff${T}0xff${T}0${T}0${T}0`, ""].join(
      "\r\n",
    );
    await writeFile(path.join(iniDir, CUSTOM_NAME), partial);
    loaded = await loadControls(game, iniDir);
    expect(findEvent(loaded.current, 1, "Console")?.keyboard).toBe("0x3b");
    expect(findEvent(loaded.current, 0, "Forward")?.keyboard).toBe("0x11");
  });

  it("enregistre une copie complète après une copie de sécurité, et Annuler remet l'état d'avant", async () => {
    const loaded = await loadControls(game, iniDir);
    const edited = withKeyboard(loaded.current, 0, "Forward", [[0x48]]);
    const plan = planControlsSave(loaded, edited);
    expect(plan.created).toBe(true);
    expect(plan.changes).toEqual([{ context: 0, name: "Forward", before: "0x11", after: "0x48" }]);

    const backup = await commitControlsSave(plan);
    const custom = path.join(iniDir, CUSTOM_NAME);
    expect(await readFile(custom, "latin1")).toBe(BASE.replace("0x11", "0x48"));

    await restoreBackup(backup.dir);
    expect(await readdir(iniDir)).not.toContain(CUSTOM_NAME);
  });

  it("garde l'ancien fichier personnel dans la copie de sécurité", async () => {
    const custom = path.join(iniDir, CUSTOM_NAME);
    await writeFile(custom, BASE);
    const loaded = await loadControls(game, iniDir);
    const plan = planControlsSave(loaded, withKeyboard(loaded.current, 0, "Jump", []));
    expect(plan.created).toBe(false);
    const backup = await commitControlsSave(plan);
    expect(await readFile(path.join(backup.dir, CUSTOM_NAME), "latin1")).toBe(BASE);
    expect(await readFile(custom, "latin1")).toBe(BASE.replace("0x39", "0xff"));
    await restoreBackup(backup.dir);
    expect(await readFile(custom, "latin1")).toBe(BASE);
  });

  it("refuse d'écrire dans un fichier personnel en lecture seule", async () => {
    const custom = path.join(iniDir, CUSTOM_NAME);
    await writeFile(custom, BASE);
    await chmod(custom, 0o444);
    const loaded = await loadControls(game, iniDir);
    const plan = planControlsSave(loaded, withKeyboard(loaded.current, 0, "Jump", []));
    await expect(commitControlsSave(plan)).rejects.toMatchObject({ code: "readOnly" });
    expect(await readFile(custom, "latin1")).toBe(BASE);
  });

  it("signale une table introuvable", async () => {
    await rm(path.join(game, "Data", "Skyrim - Interface.bsa"));
    await expect(loadControls(game, iniDir)).rejects.toThrow();
  });
});
