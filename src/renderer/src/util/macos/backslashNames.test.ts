import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { fixBackslashNames } from "./backslashNames";

describe("fixBackslashNames", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-backslash-"));
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const write = (name: string, content = "x") => fs.writeFileSync(path.join(tmp, name), content);

  it("turns Windows separators into folders", async () => {
    write("Data\\SKSE\\Plugins\\PriorityMod.dll", "dll");
    write("Data\\SKSE\\Plugins\\PriorityMod.toml", "toml");

    expect(await fixBackslashNames(tmp)).toBe(2);

    expect(
      fs.readFileSync(path.join(tmp, "Data", "SKSE", "Plugins", "PriorityMod.dll"), "utf8"),
    ).toBe("dll");
    expect(fs.readdirSync(tmp)).toEqual(["Data"]);
  });

  it("leaves a normal tree alone", async () => {
    fs.mkdirSync(path.join(tmp, "meshes"));
    fs.writeFileSync(path.join(tmp, "meshes", "a.nif"), "mesh");

    expect(await fixBackslashNames(tmp)).toBe(0);
    expect(fs.readdirSync(path.join(tmp, "meshes"))).toEqual(["a.nif"]);
  });

  it("merges into folders that already exist, in a nested folder too", async () => {
    fs.mkdirSync(path.join(tmp, "Data", "textures"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "Data", "textures", "old.dds"), "old");
    fs.writeFileSync(path.join(tmp, "Data", "textures\\new.dds"), "new");
    // l'entrée de dossier d'un ZIP Windows, sans contenu
    fs.mkdirSync(path.join(tmp, "Data\\SKSE\\"));

    expect(await fixBackslashNames(tmp)).toBe(1);

    expect(fs.readdirSync(path.join(tmp, "Data", "textures")).sort()).toEqual([
      "new.dds",
      "old.dds",
    ]);
    expect(fs.readdirSync(tmp)).toEqual(["Data"]);
  });

  it("ignores segments that would climb out of the folder", async () => {
    write("..\\..\\evil.txt", "evil");

    await fixBackslashNames(tmp);

    expect(fs.existsSync(path.join(tmp, "evil.txt"))).toBe(true);
    expect(fs.existsSync(path.join(path.dirname(tmp), "evil.txt"))).toBe(false);
  });

  it("copes with a missing folder", async () => {
    expect(await fixBackslashNames(path.join(tmp, "nope"))).toBe(0);
  });
});
