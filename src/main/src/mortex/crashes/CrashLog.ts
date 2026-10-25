/**
 * mORTEX : lecture de `crash_events.jsonl`, l'export de sKYCRASH (lecture seule, jamais d'écriture
 * dans son dossier). Un curseur d'octets évite de relire tout le fichier : seules les lignes
 * ajoutées depuis le dernier passage sont lues, et une ligne incomplète (écriture en cours)
 * attend le passage suivant. Un fichier plus court que le curseur (rotation, réécriture) est relu
 * depuis le début.
 */
import { open, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import type { CrashEvent, CrashReadResult } from "@vortex/shared/ipc";

import { parseCrashLine } from "./schema";

/** Plantages gardés en mémoire : les plus récents. */
const MAX_EVENTS = 200;

export function defaultCrashLogPath(): string {
  return (
    process.env["MORTEX_CRASH_EVENTS"] ??
    path.join(
      homedir(),
      "Library",
      "Application Support",
      "SkyrimCrashAnalyzer",
      "exports",
      "crash_events.jsonl",
    )
  );
}

const eventKey = (event: CrashEvent) => `${event.crash_time}\u0000${event.log_name}`;

export class CrashLog {
  private offset = 0;
  private events = new Map<string, CrashEvent>();
  private skipped = 0;
  private revision = 0;
  private available = false;
  private busy: Promise<void> | undefined;

  constructor(private readonly file: string = defaultCrashLogPath()) {}

  /** Relit ce qui a changé ; sans changement depuis `knownRevision`, `events` est omis. */
  async read(knownRevision?: number): Promise<CrashReadResult> {
    // Appels simultanés (plusieurs cartes qui interrogent) : un seul passage de lecture.
    this.busy ??= this.refresh().finally(() => {
      this.busy = undefined;
    });
    await this.busy;

    const result: CrashReadResult = {
      available: this.available,
      revision: this.revision,
      skipped: this.skipped,
    };
    if (knownRevision !== this.revision) {
      result.events = [...this.events.values()];
    }
    return result;
  }

  private reset(): void {
    this.offset = 0;
    this.events.clear();
    this.skipped = 0;
  }

  private async refresh(): Promise<void> {
    let size: number;
    try {
      size = (await stat(this.file)).size;
    } catch {
      if (this.available || this.events.size > 0) {
        this.reset();
        this.revision++;
      }
      this.available = false;
      return;
    }

    let changed = !this.available;
    this.available = true;
    if (size < this.offset) {
      this.reset();
      changed = true;
    }
    if (size > this.offset) {
      changed = (await this.readNewLines()) || changed;
    }
    if (changed) {
      this.revision++;
    }
  }

  /**
   * Lit du curseur à la fin du fichier et ne consomme que les lignes terminées par un saut de
   * ligne : le curseur reste au début d'une éventuelle ligne en cours d'écriture. Vrai si de
   * nouveaux plantages ou des lignes ignorées sont arrivés.
   */
  private async readNewLines(): Promise<boolean> {
    const handle = await open(this.file, "r");
    let chunk: Buffer;
    try {
      const { size } = await handle.stat();
      chunk = Buffer.alloc(Math.max(0, size - this.offset));
      await handle.read(chunk, 0, chunk.length, this.offset);
    } finally {
      await handle.close();
    }

    const lastNewline = chunk.lastIndexOf(0x0a);
    if (lastNewline < 0) {
      return false;
    }
    this.offset += lastNewline + 1;

    let changed = false;
    for (const line of chunk.subarray(0, lastNewline).toString("utf8").split("\n")) {
      const parsed = parseCrashLine(line);
      if (parsed === undefined) {
        continue;
      }
      changed = true;
      if ("skipped" in parsed) {
        this.skipped++;
      } else {
        // Une ré-analyse du même log remplace l'ancienne ligne (et passe en dernier).
        this.events.delete(eventKey(parsed.event));
        this.events.set(eventKey(parsed.event), parsed.event);
      }
    }
    while (this.events.size > MAX_EVENTS) {
      this.events.delete(this.events.keys().next().value as string);
    }
    return changed;
  }
}
