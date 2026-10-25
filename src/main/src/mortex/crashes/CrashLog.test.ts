import { appendFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CrashLog } from "./CrashLog";

const SAMPLE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "crash_events.sample.jsonl",
);

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "mortex-crashes-"));
  file = path.join(dir, "crash_events.jsonl");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("CrashLog", () => {
  it("fichier absent : indisponible, sans erreur", async () => {
    const result = await new CrashLog(file).read();
    expect(result.available).toBe(false);
    expect(result.events).toEqual([]);
  });

  it("lit les plantages valides, ignore la ligne corrompue et le schéma inconnu", async () => {
    await writeFile(file, await readFile(SAMPLE));
    const result = await new CrashLog(file).read();
    expect(result.available).toBe(true);
    expect(result.skipped).toBe(2);
    expect(result.events?.map((e) => e.log_name)).toEqual([
      "crash-2026-10-24-21-14-03.log",
      "crash-2026-10-24-22-02-41.log",
      "crash-2026-10-25-10-30-12.log",
    ]);
  });

  it("garde le suspect connu avec ses raisons et écarte un suspect de kind inconnu", async () => {
    await writeFile(file, await readFile(SAMPLE));
    const events = (await new CrashLog(file).read()).events ?? [];
    expect(events[0]?.suspects[0]).toEqual({
      name: "EngineFixes.dll",
      kind: "dll",
      score: 0.92,
      reasons: ["Dans la pile d'appels (3 fois)", "Construit pour 1.5.97, jeu en 1.6.1170"],
    });
    expect(events[2]?.suspects.map((s) => s.name)).toEqual(["EngineFixes.dll"]);
    expect(events[2]?.skse_runtime).toBeNull();
  });

  it("curseur : après ajout de lignes, ne relit que le nouveau et change de révision", async () => {
    const first = (await readFile(SAMPLE, "utf8")).split("\n").slice(0, 1).join("\n") + "\n";
    await writeFile(file, first);
    const log = new CrashLog(file);
    const a = await log.read();
    expect(a.events).toHaveLength(1);

    const same = await log.read(a.revision);
    expect(same.revision).toBe(a.revision);
    expect(same.events).toBeUndefined();

    await appendFile(
      file,
      '{"schema":1,"crash_time":"2026-10-26T08:00:00","log_name":"n.log","suspects":[]}\n',
    );
    const b = await log.read(a.revision);
    expect(b.revision).toBeGreaterThan(a.revision);
    expect(b.events?.map((e) => e.log_name)).toEqual(["crash-2026-10-24-21-14-03.log", "n.log"]);
  });

  it("une ligne en cours d'écriture attend sa fin", async () => {
    await writeFile(
      file,
      '{"schema":1,"crash_time":"t1","log_name":"a.log","suspects":[]}\n{"schema":1,',
    );
    const log = new CrashLog(file);
    expect((await log.read()).events).toHaveLength(1);
    await appendFile(file, '"crash_time":"t2","log_name":"b.log","suspects":[]}\n');
    const result = await log.read();
    expect(result.events?.map((e) => e.log_name)).toEqual(["a.log", "b.log"]);
    expect(result.skipped).toBe(0);
  });

  it("fichier réécrit plus court : relu depuis le début", async () => {
    await writeFile(file, await readFile(SAMPLE));
    const log = new CrashLog(file);
    await log.read();
    await writeFile(file, '{"schema":1,"crash_time":"t","log_name":"seul.log","suspects":[]}\n');
    const result = await log.read();
    expect(result.events?.map((e) => e.log_name)).toEqual(["seul.log"]);
    expect(result.skipped).toBe(0);
  });

  it("ré-analyse du même log : remplace l'ancienne ligne", async () => {
    const line = (verdict: string) =>
      `{"schema":1,"crash_time":"t","log_name":"a.log","verdict":"${verdict}","suspects":[]}\n`;
    await writeFile(file, line("ancien"));
    const log = new CrashLog(file);
    await log.read();
    await appendFile(file, line("nouveau"));
    const events = (await log.read()).events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]?.verdict).toBe("nouveau");
  });
});

describe("contrat réel de sKYCRASH", () => {
  it("lit une ligne produite par export_events.py (scores entiers, constats env)", async () => {
    const real = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "__fixtures__",
      "crash_events.skycrash_real.jsonl",
    );
    const dir2 = await mkdtemp(path.join(tmpdir(), "mortex-real-"));
    const copy = path.join(dir2, "crash_events.jsonl");
    await writeFile(copy, await readFile(real));
    const result = await new CrashLog(copy).read();
    await rm(dir2, { recursive: true, force: true });
    expect(result.skipped).toBe(0);
    const event = result.events?.[0];
    expect(event?.log_name).toBe("crash-2026-10-07-22-35-01.log");
    expect(event?.suspects[0]).toMatchObject({ name: "tbbmalloc.dll", kind: "dll", score: 6 });
    expect(event?.suspects.filter((s) => s.kind === "env").map((s) => s.name)).toContain(
      "renderer:D3DMetal",
    );
  });
});
