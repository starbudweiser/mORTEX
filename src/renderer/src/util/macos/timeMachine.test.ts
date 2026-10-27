import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  canClone,
  createSnapshot,
  deleteSnapshot,
  type ISnapshot,
  listSnapshots,
  restoreFiles,
  snapshotsToPrune,
} from "./timeMachine";

const HOUR = 3600 * 1000;

describe("time machine", () => {
  let tmp: string;
  let data: string;
  let staging: string;
  let ini: string;
  let root: string;

  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  const read = (file: string) => fs.readFileSync(file, "utf8");

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-tm-"));
    data = path.join(tmp, "game", "Data");
    staging = path.join(tmp, "staging");
    ini = path.join(tmp, "My Games", "Skyrim.ini");
    root = path.join(tmp, "snapshots");
    write(path.join(data, "Skyrim.esm"), "base");
    write(path.join(data, "meshes", "body.nif"), "bodyslide v1");
    write(path.join(staging, "ModA", "a.esp"), "a v1");
    fs.linkSync(path.join(staging, "ModA", "a.esp"), path.join(data, "a.esp"));
    write(ini, "[Display]\nfov=70\n");
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const take = (now: number) =>
    createSnapshot(root, {
      reason: "manual",
      gameId: "skyrimse",
      profileId: "p1",
      profileName: "Default",
      managed: ["a.esp"],
      mods: { ModA: { id: "ModA" } },
      modState: { ModA: { enabled: true } },
      dataPath: data,
      stagingPath: staging,
      configFiles: [ini, path.join(tmp, "missing.ini")],
      now,
    });

  it("brings back Data, the mods and the INI exactly as they were", async () => {
    expect(await canClone([data, staging, tmp])).toBe(true);
    const snapshot = await take(Date.now());
    expect(snapshot).toMatchObject({ modCount: 1, enabledCount: 1 });
    expect(snapshot.config).toHaveLength(1);

    // la suite : un outil réécrit une sortie, un mod change, l'INI aussi, un fichier apparaît
    write(path.join(data, "meshes", "body.nif"), "bodyslide v2");
    write(path.join(data, "Nemesis.hkx"), "new");
    fs.rmSync(path.join(staging, "ModA"), { recursive: true });
    write(path.join(staging, "ModB", "b.esp"), "b");
    write(ini, "[Display]\nfov=90\n");
    // la purge retire les fichiers déployés
    fs.rmSync(path.join(data, "a.esp"));

    await restoreFiles(root, snapshot, { dataPath: data, stagingPath: staging });

    expect(read(path.join(data, "meshes", "body.nif"))).toBe("bodyslide v1");
    expect(fs.existsSync(path.join(data, "Nemesis.hkx"))).toBe(false);
    expect(read(path.join(data, "Skyrim.esm"))).toBe("base");
    // déployé à l'époque : laissé au déploiement qui suit
    expect(fs.existsSync(path.join(data, "a.esp"))).toBe(false);
    expect(read(path.join(staging, "ModA", "a.esp"))).toBe("a v1");
    expect(fs.existsSync(path.join(staging, "ModB"))).toBe(false);
    expect(read(ini)).toBe("[Display]\nfov=70\n");
    // l'instantané lui-même n'a pas bougé
    expect((await listSnapshots(root)).map((s) => s.id)).toEqual([snapshot.id]);
  });

  it("lists the newest first and deletes", async () => {
    const now = Date.now();
    const older = await take(now - HOUR);
    const newer = await take(now);
    expect((await listSnapshots(root)).map((s) => s.id)).toEqual([newer.id, older.id]);
    await deleteSnapshot(root, older.id);
    expect((await listSnapshots(root)).map((s) => s.id)).toEqual([newer.id]);
  });

  it("keeps everything for a day, then the latest of each day for two weeks", () => {
    const now = new Date(2026, 9, 27, 20, 0).getTime();
    const at = (hoursAgo: number) =>
      ({ id: `${hoursAgo}h`, created: now - hoursAgo * HOUR }) as ISnapshot;
    const snapshots = [at(1), at(5), at(23), at(30), at(31), at(50), at(24 * 15)];
    expect(
      snapshotsToPrune(snapshots, now)
        .map((s) => s.id)
        .sort(),
    ).toEqual(["31h", "360h"]);
  });
});
