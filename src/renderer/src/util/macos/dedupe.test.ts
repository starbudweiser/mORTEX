import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { cloneDuplicates, findDuplicates } from "./dedupe";

describe("dedupe by clones", () => {
  let tmp: string;
  const write = (rel: string, text: string) => {
    const file = path.join(tmp, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return file;
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mortex-dedupe-"));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("finds identical files across mods and turns them into clones", async () => {
    const texture = "x".repeat(2000);
    write("ModA v1/textures/rock.dds", texture);
    write("ModA v2/textures/rock.dds", texture);
    write("Pack/textures/rock_copy.dds", texture);
    write("ModB/textures/other.dds", "y".repeat(2000));
    write("ModB/small.txt", "x");
    // déjà un lien vers le même fichier : rien à regagner
    fs.linkSync(path.join(tmp, "ModA v1/textures/rock.dds"), path.join(tmp, "linked.dds"));

    const found = await findDuplicates(tmp, 1000);
    expect(found.groups).toHaveLength(1);
    expect(found.groups[0].map((file) => path.relative(tmp, file))).toEqual([
      "ModA v1/textures/rock.dds",
      "ModA v2/textures/rock.dds",
      "Pack/textures/rock_copy.dds",
    ]);
    expect(found).toMatchObject({ savings: 4000, files: 2 });

    expect(await cloneDuplicates(found.groups)).toBe(4000);
    for (const file of found.groups[0]) {
      expect(fs.readFileSync(file, "utf8")).toBe(texture);
    }
    // un clone se sépare quand on le modifie
    fs.writeFileSync(found.groups[0][1], "changed");
    expect(fs.readFileSync(found.groups[0][0], "utf8")).toBe(texture);
    expect(fs.readdirSync(path.join(tmp, "ModA v2/textures"))).toEqual(["rock.dds"]);
  });
});
