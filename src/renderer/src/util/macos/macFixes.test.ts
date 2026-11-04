import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { IBottle, IBottleLaunch } from "./bottlesCore";
import { displayTweaksTargets } from "./dxmtChecks";
import {
  MAC_TEXT_KEYS,
  appliedFixes,
  apply,
  backupDir,
  plan,
  readManifest,
  undo,
} from "./macFixes";
import type { IMacManifest } from "./macManifest";

/** Bottled Shaders : « Bottled » dans la DLL et sa version dans les ressources */
const bottledDll = (version: string) =>
  Buffer.concat([
    Buffer.from("MZ...Bottled..."),
    Buffer.from("FileVersion", "utf16le"),
    Buffer.from(`\0\0 ${version}.0`, "utf16le"),
  ]);

describe("mackit plan / apply / undo", () => {
  let tmp: string;
  let bottle: IBottle;
  let game: string;
  let plugins: string;
  let bridge: string;
  let wine: IBottleLaunch[];
  let regs: string[];

  const write = (file: string, content: string | Buffer) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };
  const read = (file: string) => fs.readFileSync(file, "utf8");

  /** empreinte de chaque fichier d'un dossier */
  const snapshot = (dir: string): Record<string, string> => {
    const result: Record<string, string> = {};
    const walk = (current: string) => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const file = path.join(current, entry.name);
        if (entry.isDirectory()) walk(file);
        else
          result[path.relative(dir, file)] = createHash("sha256")
            .update(fs.readFileSync(file))
            .digest("hex");
      }
    };
    walk(dir);
    return result;
  };

  // la commande wine de l'essai : on garde le .reg qu'elle devait appliquer
  const run = async (command: IBottleLaunch) => {
    wine.push(command);
    regs.push(
      fs.readFileSync(
        path.join(bottle.path, "drive_c", "windows", "temp", "mortex-dll-overrides.reg"),
        "latin1",
      ),
    );
  };

  const settingsPath = () => path.join(plugins, "CommunityShaders", "SettingsUser.json");
  const iniPath = () => path.join(plugins, "SSEDisplayTweaks.ini");
  const manifest = () =>
    JSON.parse(read(path.join(backupDir(game), "manifest.json"))) as IMacManifest;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mackit-fixes-"));
    bottle = {
      path: path.join(tmp, "bottle"),
      name: "Skyrim",
      kind: "crossover",
      userDir: "",
    };
    game = path.join(bottle.path, "drive_c", "Games", "Skyrim Special Edition");
    plugins = path.join(game, "Data", "SKSE", "Plugins");
    bridge = path.join(tmp, "mdlss", "d3d11.dll");
    wine = [];
    regs = [];

    write(
      path.join(bottle.path, "cxbottle.conf"),
      '[EnvironmentVariables]\n"CX_GRAPHICS_BACKEND" = "dxvk"\n',
    );
    write(path.join(bottle.path, "user.reg"), "WINE REGISTRY Version 2\n");
    write(bridge, "MZ...mDLSS_enb_bridge.log...");
    write(path.join(game, "d3d11.dll"), "ENBSeries d3d11");
    write(path.join(plugins, "CommunityShaders.dll"), bottledDll("1.0.26"));
    write(path.join(plugins, "TerrainHelper.dll"), "terrain");
    write(path.join(plugins, "EVLaS.dll"), "evlas");
    write(iniPath(), "[Render]\nSwapEffect = auto ; keep me\nOther = 1\n");
    write(settingsPath(), JSON.stringify({ Upscaling: { upscaleMethod: 1 }, Other: true }));
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  const makePlan = () => plan(game, bottle, { bridgeSource: bridge });
  const ids = (list: Array<{ id: string }>) => list.map((item) => item.id);

  describe("plan", () => {
    it("lists what would be done without writing anything", async () => {
      const before = snapshot(tmp);
      const result = await makePlan();

      expect(snapshot(tmp)).toEqual(before);
      expect(fs.existsSync(backupDir(game))).toBe(false);
      expect(ids(result.fixes)).toEqual([
        "engine",
        "bridge",
        "displayTweaks",
        "duplicates",
        "overrides",
      ]);
      expect(result.skipped).toEqual([]);
      expect(result.checks.map((check) => check.id)).toContain("bottledDuplicates");
      expect(result.health.length).toBeGreaterThan(0);
    });

    it("says which files it would set aside, and why", async () => {
      const { discarded } = await makePlan();
      expect(discarded).toEqual([
        {
          file: path.join(plugins, "EVLaS.dll"),
          fix: "duplicates",
          reason: { key: "mackit.discard.evlas" },
        },
        {
          file: path.join(plugins, "TerrainHelper.dll"),
          fix: "duplicates",
          reason: { key: "mackit.discard.terrainHelper" },
        },
      ]);
    });

    it("announces the exact INI lines it would change", async () => {
      const { fixes } = await makePlan();
      const tweaks = fixes.find((fix) => fix.id === "displayTweaks");
      expect(tweaks?.changes?.map((change) => `${change.key}=${change.newValue}`)).toEqual([
        "SwapEffect=flip_discard",
        "SwapBufferCount=3",
        `VideoMemorySizeMb=${displayTweaksTargets().VideoMemorySizeMb}`,
      ]);
    });

    it("gives only translation keys, never sentences", async () => {
      const result = await plan(game, bottle, { bridgeSource: bridge, bottledVersion: "1.0.25" });
      const keys: string[] = [];
      JSON.parse(JSON.stringify(result), function walk(this: unknown, name, value) {
        if (name === "key" && typeof value === "string" && value.startsWith("mackit."))
          keys.push(value);
        return value;
      });
      expect(keys.length).toBeGreaterThan(5);
      for (const key of keys) expect(MAC_TEXT_KEYS).toContain(key);
    });

    it("plans nothing for a game that is already right", async () => {
      write(path.join(bottle.path, "cxbottle.conf"), '"CX_GRAPHICS_BACKEND" = "dxmt"\n');
      write(path.join(game, "d3d11.dll"), "MZ...mDLSS_enb_bridge.log...");
      fs.rmSync(path.join(plugins, "TerrainHelper.dll"));
      fs.rmSync(path.join(plugins, "EVLaS.dll"));
      const targets = displayTweaksTargets();
      write(
        iniPath(),
        `[Render]\nSwapEffect = flip_discard\nSwapBufferCount = 3\nVideoMemorySizeMb = ${targets.VideoMemorySizeMb}\n`,
      );
      write(
        path.join(bottle.path, "user.reg"),
        '[Software\\\\Wine\\\\DllOverrides] 1\n"d3d11"="native,builtin"\n',
      );
      expect((await makePlan()).fixes).toEqual([]);
    });

    it("skips the bottle fixes when the game runs outside any bottle, and says so", async () => {
      const result = await plan(game, undefined, { bridgeSource: bridge });
      expect(ids(result.fixes)).toEqual(["bridge", "displayTweaks", "duplicates"]);
      expect(result.skipped.map((skipped) => skipped.id)).toEqual([
        "engine",
        "compiler",
        "overrides",
      ]);
      expect(result.skipped[0].reason).toEqual({ key: "mackit.skip.noBottle" });
      expect(result.health).toEqual([]);
    });

    it("skips the bridge when the app brings none", async () => {
      const result = await plan(game, bottle);
      expect(ids(result.fixes)).not.toContain("bridge");
      expect(result.skipped).toEqual([
        { id: "bridge", reason: { key: "mackit.skip.bridgeSourceMissing" } },
      ]);
    });

    it("flags a Bottled Shaders older than 1.0.26 as to be updated", async () => {
      write(path.join(plugins, "CommunityShaders.dll"), bottledDll("1.0.25"));
      const { bottled } = await makePlan();
      expect(bottled.state).toBe("outdated");
      expect(bottled.text).toEqual({
        key: "mackit.bottled.outdated",
        params: { version: "1.0.25", minimum: "1.0.26" },
      });
      expect((await makePlan()).fixes.length).toBeGreaterThan(0);
    });

    it("accepts Bottled Shaders 1.0.26", async () => {
      expect((await makePlan()).bottled).toMatchObject({ state: "ok", version: "1.0.26" });
    });

    describe("Microsoft's shader compiler", () => {
      const compiler = () =>
        path.join(bottle.path, "drive_c", "windows", "system32", "d3dcompiler_47.dll");
      const failedLog = () =>
        write(
          path.join(
            bottle.path,
            "drive_c",
            "users",
            "crossover",
            "Documents",
            "My Games",
            "Skyrim Special Edition",
            "SKSE",
            "BottledShaders.log",
          ),
          "[E] Shader compilation failed:\n",
        );

      it("is skipped when .NET 8 is not in the bottle yet", async () => {
        write(compiler(), Buffer.alloc(180_000));
        failedLog();
        const result = await makePlan();
        expect(result.skipped).toContainEqual({
          id: "compiler",
          reason: { key: "mackit.skip.dotnetMissing" },
        });
      });

      it("replaces Wine's compiler and gives it back on undo", async () => {
        write(compiler(), Buffer.alloc(180_000, 1));
        write(
          path.join(
            bottle.path,
            "drive_c",
            "Program Files",
            "dotnet",
            "shared",
            "Microsoft.WindowsDesktop.App",
            "8.0.9",
            "D3DCompiler_47_cor3.dll",
          ),
          Buffer.alloc(4_500_000, 2),
        );
        failedLog();
        const before = snapshot(tmp);
        const result = await makePlan();
        expect(ids(result.fixes)).toContain("compiler");

        await apply(result, { only: ["compiler"], run });
        expect(fs.statSync(compiler()).size).toBe(4_500_000);

        await undo(game, "compiler", { run });
        expect(snapshot(tmp)).toEqual(before);
      });
    });
  });

  describe("apply", () => {
    it("applies every fix and writes the manifest", async () => {
      const original = {
        conf: read(path.join(bottle.path, "cxbottle.conf")),
        d3d11: read(path.join(game, "d3d11.dll")),
        ini: read(iniPath()),
        settings: read(settingsPath()),
      };
      const result = await apply(await makePlan(), { run });

      expect(result.outcomes.map((outcome) => `${outcome.id}:${outcome.status}`)).toEqual([
        "engine:applied",
        "bridge:applied",
        "displayTweaks:applied",
        "duplicates:applied",
        "overrides:applied",
      ]);
      expect(read(path.join(bottle.path, "cxbottle.conf"))).toContain(
        '"CX_GRAPHICS_BACKEND" = "dxmt"',
      );
      expect(read(path.join(game, "d3d11.dll"))).toContain("mDLSS_enb_bridge.log");
      expect(JSON.parse(read(settingsPath()))).toEqual({
        Upscaling: { upscaleMethod: 3 },
        Other: true,
      });
      expect(read(iniPath())).toContain("SwapEffect = flip_discard ; keep me");
      expect(fs.existsSync(path.join(plugins, "TerrainHelper.dll"))).toBe(false);
      expect(fs.existsSync(path.join(plugins, "EVLaS.dll"))).toBe(false);
      expect(wine).toHaveLength(1);
      expect(regs[0]).toContain('"d3d11"="native,builtin"');

      // le manifeste : fichier, empreinte avant, empreinte après, correctif d'origine
      const { entries } = manifest();
      const sha = (content: string) => createHash("sha256").update(content).digest("hex");
      const conf = entries.find(
        (entry) => entry.kind === "file" && entry.file.endsWith("cxbottle.conf"),
      );
      expect(conf).toMatchObject({
        fix: "engine",
        before: sha(original.conf),
        after: sha(read(path.join(bottle.path, "cxbottle.conf"))),
      });
      const removed = entries.find(
        (entry) => entry.kind === "file" && entry.file.endsWith("EVLaS.dll"),
      );
      expect(removed).toMatchObject({ fix: "duplicates", before: sha("evlas"), after: null });
      const d3d11 = entries.find(
        (entry) => entry.kind === "file" && entry.file.endsWith("d3d11.dll"),
      );
      expect(d3d11).toMatchObject({ fix: "bridge", before: sha(original.d3d11) });
      expect(entries.find((entry) => entry.kind === "registry")).toMatchObject({
        fix: "overrides",
        dlls: ["d3d11"],
      });

      // chaque fichier remplacé est sauvegardé tel qu'il était dans <jeu>/_MAC_BACKUP
      for (const entry of entries) {
        if (entry.kind === "file" && entry.backup !== null) {
          expect(fs.existsSync(path.join(backupDir(game), entry.backup))).toBe(true);
        }
      }
      const backups = entries.flatMap((entry) => (entry.kind === "file" ? [entry.backup] : []));
      expect(backups.map((backup) => backup && read(path.join(backupDir(game), backup)))).toEqual(
        expect.arrayContaining([
          original.conf,
          original.d3d11,
          original.ini,
          original.settings,
          "terrain",
        ]),
      );
    });

    it("lists what it applied for the report", async () => {
      await apply(await makePlan(), { run });
      const applied = await appliedFixes(game);
      expect(applied.map((fix) => fix.id)).toEqual([
        "engine",
        "bridge",
        "displayTweaks",
        "duplicates",
        "overrides",
      ]);
      expect(applied.find((fix) => fix.id === "overrides")?.dlls).toEqual(["d3d11"]);
      expect(applied.find((fix) => fix.id === "duplicates")?.files).toHaveLength(2);
    });

    it("applies only the fixes it is asked for", async () => {
      const result = await apply(await makePlan(), { only: ["displayTweaks"], run });
      expect(ids(result.outcomes)).toEqual(["displayTweaks"]);
      expect(read(path.join(bottle.path, "cxbottle.conf"))).toContain("dxvk");
      expect(fs.existsSync(path.join(plugins, "TerrainHelper.dll"))).toBe(true);
    });

    it("refuses to overwrite a file that changed since the plan, and keeps going with the others", async () => {
      const planned = await makePlan();
      write(path.join(bottle.path, "cxbottle.conf"), '"CX_GRAPHICS_BACKEND" = "d3dmetal"\n');

      const result = await apply(planned, { run });
      const engine = result.outcomes.find((outcome) => outcome.id === "engine");
      expect(engine).toMatchObject({
        status: "failed",
        text: { key: "mackit.apply.changed", params: { file: "cxbottle.conf" } },
      });
      expect(read(path.join(bottle.path, "cxbottle.conf"))).toBe(
        '"CX_GRAPHICS_BACKEND" = "d3dmetal"\n',
      );
      expect(result.outcomes.filter((outcome) => outcome.status === "applied")).toHaveLength(4);
      expect(manifest().entries.some((entry) => entry.fix === "engine")).toBe(false);
    });

    it("puts back what a fix had already written when it fails half way", async () => {
      const planned = await makePlan();
      // le pont est copié d'abord, puis les réglages de Bottled ont changé : le correctif entier est annulé
      write(settingsPath(), JSON.stringify({ Upscaling: { upscaleMethod: 2 } }));

      const result = await apply(planned, { only: ["bridge"], run });
      expect(result.outcomes[0].status).toBe("failed");
      expect(read(path.join(game, "d3d11.dll"))).toBe("ENBSeries d3d11");
      expect(JSON.parse(read(settingsPath()))).toEqual({ Upscaling: { upscaleMethod: 2 } });
      expect(fs.existsSync(backupDir(game))).toBe(false);
    });

    it("creates the bridge when there was no d3d11.dll, and undo removes it again", async () => {
      fs.rmSync(path.join(game, "d3d11.dll"));
      await apply(await makePlan(), { only: ["bridge"], run });
      expect(fs.existsSync(path.join(game, "d3d11.dll"))).toBe(true);
      expect(manifest().entries[0]).toMatchObject({ fix: "bridge", before: null, backup: null });

      await undo(game, "bridge", { run });
      expect(fs.existsSync(path.join(game, "d3d11.dll"))).toBe(false);
    });
  });

  describe("undo", () => {
    it("restores one fix from the manifest, and forgets it", async () => {
      await apply(await makePlan(), { run });
      const result = await undo(game, "duplicates", { run });

      expect(result.fixes).toEqual([
        { id: "duplicates", status: "restored", text: { key: "mackit.undo.ok" } },
      ]);
      expect(read(path.join(plugins, "TerrainHelper.dll"))).toBe("terrain");
      expect(read(path.join(plugins, "EVLaS.dll"))).toBe("evlas");
      expect(manifest().entries.some((entry) => entry.fix === "duplicates")).toBe(false);
      expect(manifest().entries.some((entry) => entry.fix === "engine")).toBe(true);
      expect((await appliedFixes(game)).map((fix) => fix.id)).not.toContain("duplicates");
    });

    it("puts everything back exactly as it was and leaves no trace", async () => {
      const before = snapshot(tmp);
      await apply(await makePlan(), { run });
      expect(snapshot(tmp)).not.toEqual(before);

      const result = await undo(game, "all", { run });
      expect(result.fixes.map((fix) => fix.status)).toEqual(Array(5).fill("restored"));
      expect(ids(result.fixes)).toEqual([
        "overrides",
        "duplicates",
        "displayTweaks",
        "bridge",
        "engine",
      ]);
      expect(snapshot(tmp)).toEqual(before);
      expect(fs.existsSync(backupDir(game))).toBe(false);
      // les overrides sont retirés du registre de la bouteille
      expect(regs.at(-1)).toContain('"d3d11"=-');
    });

    it("refuses to restore a file that changed since, and says which", async () => {
      await apply(await makePlan(), { run });
      write(iniPath(), "[Render]\nSwapEffect = flip_discard\n; edited by hand\n");

      const result = await undo(game, "displayTweaks", { run });
      expect(result.fixes[0]).toMatchObject({
        id: "displayTweaks",
        status: "refused",
        text: { key: "mackit.undo.changed", params: { file: "SSEDisplayTweaks.ini" } },
        refusals: [{ file: iniPath(), reason: "changed" }],
      });
      expect(read(iniPath())).toContain("edited by hand");
      expect(manifest().entries.some((entry) => entry.fix === "displayTweaks")).toBe(true);
    });

    it("leaves a refused fix alone but still restores the others on 'all'", async () => {
      await apply(await makePlan(), { run });
      write(iniPath(), "[Render]\nSwapEffect = flip_discard\n; edited by hand\n");

      const result = await undo(game, "all", { run });
      expect(Object.fromEntries(result.fixes.map((fix) => [fix.id, fix.status]))).toEqual({
        overrides: "restored",
        duplicates: "restored",
        displayTweaks: "refused",
        bridge: "restored",
        engine: "restored",
      });
      expect(read(path.join(plugins, "TerrainHelper.dll"))).toBe("terrain");
      expect(read(iniPath())).toContain("edited by hand");
      expect((await appliedFixes(game)).map((fix) => fix.id)).toEqual(["displayTweaks"]);
    });

    it("refuses a whole fix, not half of it, when one of its files changed", async () => {
      await apply(await makePlan(), { run });
      write(settingsPath(), "{}"); // réglages de Bottled modifiés ; d3d11.dll n'a pas bougé

      const result = await undo(game, "bridge", { run });
      expect(result.fixes[0].status).toBe("refused");
      expect(read(path.join(game, "d3d11.dll"))).toContain("mDLSS_enb_bridge.log");
    });

    it("refuses when the saved copy has been lost", async () => {
      await apply(await makePlan(), { only: ["duplicates"], run });
      fs.rmSync(path.join(backupDir(game), "files"), { recursive: true });

      const result = await undo(game, "duplicates", { run });
      expect(result.fixes[0]).toMatchObject({
        status: "refused",
        text: { key: "mackit.undo.backupMissing" },
      });
    });

    it("refuses to undo overrides someone else changed since", async () => {
      await apply(await makePlan(), { only: ["overrides"], run });
      write(
        path.join(bottle.path, "user.reg"),
        '[Software\\\\Wine\\\\DllOverrides] 1\n"d3d11"="builtin"\n',
      );

      const result = await undo(game, "overrides", { run });
      expect(result.fixes[0].status).toBe("refused");
      expect(wine).toHaveLength(1);
    });

    it("says so when the manifest has never heard of the fix", async () => {
      expect((await undo(game, "engine")).fixes).toEqual([
        { id: "engine", status: "absent", text: { key: "mackit.undo.absent" } },
      ]);
      expect((await undo(game, "all")).fixes).toEqual([]);
    });

    it("keeps the manifest readable after a restart", async () => {
      await apply(await makePlan(), { only: ["engine"], run });
      expect((await readManifest(game)).entries).toHaveLength(1);
      await undo(game, "engine");
      expect((await readManifest(game)).entries).toEqual([]);
    });
  });
});
