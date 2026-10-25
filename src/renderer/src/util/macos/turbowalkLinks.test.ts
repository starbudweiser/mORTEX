import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { turbowalkLinks } from "./turbowalkLinks";

describe.skipIf(process.platform === "win32")("turbowalkLinks", () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-walk-"));
    fs.mkdirSync(path.join(tmp, "staging", "meshes"), { recursive: true });
    fs.mkdirSync(path.join(tmp, "data", "meshes"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "staging", "meshes", "a.nif"), "a");
    fs.writeFileSync(path.join(tmp, "staging", "meshes", "solo.nif"), "s");
    fs.linkSync(
      path.join(tmp, "staging", "meshes", "a.nif"),
      path.join(tmp, "data", "meshes", "a.nif"),
    );
  });

  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  async function collect(dir: string) {
    const out: Array<{ filePath: string; linkCount?: number; idStr?: string }> = [];
    await turbowalkLinks(dir, (entries) => out.push(...entries), { skipHidden: false });
    return out.filter((e) => !fs.statSync(e.filePath).isDirectory());
  }

  it("renvoie linkCount et idStr, identiques pour deux liens physiques", async () => {
    const staging = await collect(path.join(tmp, "staging"));
    const data = await collect(path.join(tmp, "data"));

    const stagingA = staging.find((e) => e.filePath.endsWith("a.nif"));
    const stagingSolo = staging.find((e) => e.filePath.endsWith("solo.nif"));

    expect(stagingA?.linkCount).toBe(2);
    expect(stagingSolo?.linkCount).toBe(1);
    expect(data).toHaveLength(1);
    expect(data[0].idStr).toBeDefined();
    expect(data[0].idStr).toBe(stagingA?.idStr);
  });

  it("ignore un dossier absent", async () => {
    expect(await collect(path.join(tmp, "absent"))).toEqual([]);
  });
});
