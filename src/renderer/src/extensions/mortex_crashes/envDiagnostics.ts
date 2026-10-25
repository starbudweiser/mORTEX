/**
 * mORTEX : diagnostic de l'environnement Mac. Les constats `kind: env` de sKYCRASH (version du
 * jeu, SKSE, Address Library, D3DMetal/DXMT, mémoire vidéo) sont recoupés avec ce que mORTEX sait
 * de la bouteille (bouteilles Wine détectées, DLL overrides du registre) et des fichiers déployés.
 * Logique pure : les lectures disque sont injectées.
 */
import type { CrashEvent } from "@vortex/shared/ipc";

import type { IBottle } from "../../util/macos/bottles";
import type { FileIndex, ILinkedSuspect } from "./linking";

/** Un fait établi par mORTEX : une clé de traduction et ses paramètres. */
export interface IEnvNote {
  key: string;
  params?: Record<string, string>;
}

export interface IEnvFinding {
  linked: ILinkedSuspect;
  notes: IEnvNote[];
}

export interface IEnvReport {
  bottle?: { name: string; known: boolean; kind?: string };
  findings: IEnvFinding[];
}

export interface IEnvSources {
  bottles: IBottle[];
  /** Valeur de `HKCU\Software\Wine\DllOverrides\<dll>` dans la bouteille. */
  dllOverride: (bottle: IBottle, dll: string) => string | undefined;
  files: FileIndex;
}

const GRAPHICS =
  /d3dmetal|dxmt|dxvk|d3d11|d3d12|dxgi|moltenvk|metal|vram|vidéo|video|gpu|renderer:|graphics_proxy|dlss|unified_memory|memory_pressure/i;
const ADDRESS_LIBRARY = /address[\s_]*library|versionlib/i;
const SKSE = /skse/i;

/** « 1.6.1170 » → « 1-6-1170 » (nom des fichiers de l'Address Library). */
const dashed = (version: string) => version.replace(/\./g, "-");

function findBottle(event: CrashEvent, bottles: IBottle[]): IBottle | undefined {
  const wanted = event.bottle?.trim().toLowerCase();
  if (wanted === undefined || wanted === "") {
    return undefined;
  }
  return bottles.find((b) => b.name.toLowerCase() === wanted || b.path.toLowerCase() === wanted);
}

export function diagnoseEnvironment(
  event: CrashEvent,
  env: ILinkedSuspect[],
  sources: IEnvSources,
): IEnvReport {
  const bottle = findBottle(event, sources.bottles);
  const report: IEnvReport = { findings: [] };
  if (event.bottle) {
    report.bottle = { name: event.bottle, known: bottle !== undefined, kind: bottle?.kind };
  }

  for (const linked of env) {
    const notes: IEnvNote[] = [];
    const name = linked.suspect.name;

    if (GRAPHICS.test(name)) {
      if (event.bottle === null) {
        notes.push({
          key: "Bottle not reported by sKYCRASH: graphics settings cannot be compared.",
        });
      } else if (bottle === undefined) {
        notes.push({ key: "Bottle unknown to mORTEX: graphics settings cannot be compared." });
      } else {
        for (const dll of ["d3d11", "dxgi", "d3d12"]) {
          const value = sources.dllOverride(bottle, dll);
          if (value !== undefined) {
            notes.push({
              key: "Bottle override {{dll}}: {{value}}",
              params: { dll, value },
            });
          }
        }
        if (notes.length === 0) {
          notes.push({
            key: "No graphics DLL override set in bottle “{{bottle}}”.",
            params: { bottle: bottle.name },
          });
        }
      }
    }

    if (ADDRESS_LIBRARY.test(name) && event.game_runtime) {
      const file = `versionlib-${dashed(event.game_runtime)}-0.bin`;
      const found = sources.files.get(file.toLowerCase());
      notes.push(
        found !== undefined
          ? { key: "{{file}} is deployed by mod {{mod}}.", params: { file, mod: found[0].modId } }
          : { key: "{{file}} is not deployed by any mORTEX mod.", params: { file } },
      );
    }

    if (SKSE.test(name) && event.game_runtime) {
      const file = `skse64_${event.game_runtime.replace(/\./g, "_")}.dll`;
      notes.push(
        sources.files.has(file)
          ? { key: "SKSE runtime {{file}} is deployed.", params: { file } }
          : { key: "No SKSE runtime {{file}} deployed by mORTEX.", params: { file } },
      );
    }

    report.findings.push({ linked, notes });
  }
  return report;
}
