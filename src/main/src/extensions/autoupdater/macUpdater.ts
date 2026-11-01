/**
 * mORTEX (macOS) : mise à jour depuis les releases GitHub de starbudweiser/mORTEX.
 *
 * Parle le même protocole que l'ancien programme de mise à jour (mêmes canaux IPC, mêmes états
 * `UpdaterState`) : l'interface existante (notifications, Réglages) fonctionne sans changement.
 *
 * Principe, simple et réversible :
 *  1. la release la plus récente éligible est cherchée (macReleases.ts) ;
 *  2. sur demande de l'utilisateur, l'archive est téléchargée, son empreinte SHA-256 vérifiée,
 *     puis décompressée dans un dossier temporaire où la signature (codesign) et l'identifiant de
 *     l'appli sont contrôlés ;
 *  3. « Redémarrer » : un petit script attend la fermeture de mORTEX, met l'ancienne version à la
 *     Corbeille (jamais supprimée), place la nouvelle et la relance. En cas d'échec, l'ancienne
 *     version est remise en place.
 * Rien n'est installé sans clic de l'utilisateur.
 */

import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";

import { getErrorMessageOrDefault } from "@vortex/shared";
import type { UpdaterSnapshot, UpdaterState, UpdaterStatusResponse } from "@vortex/shared/ipc";
import { app } from "electron";
import * as semver from "semver";

import { betterIpcMain } from "../../ipc";
import { log } from "../../logging";
import { readPersistedValue } from "../../store/mainPersistence";
import type { IMacUpdate, MacChannel } from "./macReleases";
import { parseSha256File, pickMacUpdate } from "./macReleases";

const run = promisify(execFile);

const REPO = process.env.MORTEX_UPDATER_REPO || "starbudweiser/mORTEX";
const API = process.env.MORTEX_UPDATER_API_BASE || "https://api.github.com";
const BUNDLE_ID = "fr.stephan.mortex";
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;

const toChannel = (channel: string): MacChannel => (channel === "beta" ? "beta" : "stable");

async function fetchReleases() {
  const response = await fetch(`${API}/repos/${REPO}/releases?per_page=30`, {
    headers: {
      Accept: "application/vnd.github.html+json",
      "User-Agent": `mORTEX/${app.getVersion()}`,
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub ${response.status}`);
  }
  return (await response.json()) as Parameters<typeof pickMacUpdate>[0];
}

async function sha256Of(file: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(file))
    .digest("hex");
}

/** chemin du .app en cours d'exécution (…/mORTEX.app) */
function currentAppPath(): string {
  return path.resolve(app.getPath("exe"), "..", "..", "..");
}

/** le programme d'installation, lancé à part : attend la fermeture, remplace, relance */
function installerScript(): string {
  return `#!/bin/bash
# $1 = pid de mORTEX, $2 = nouvelle appli, $3 = appli en place, $4 = destination Corbeille
while kill -0 "$1" 2>/dev/null; do sleep 0.5; done
if mv "$3" "$4"; then
  if ditto "$2" "$3"; then
    xattr -dr com.apple.quarantine "$3" 2>/dev/null
    rm -rf "$(dirname "$2")"
    open "$3"
    exit 0
  fi
  rm -rf "$3"
  mv "$4" "$3"
fi
open "$3"
exit 1
`;
}

export function setupMacUpdater(): void {
  const currentVersion = app.getVersion();
  let current: UpdaterState = { type: "idle" };
  let justUpdatedFrom: string | undefined;
  let channel = "stable";
  let offered: IMacUpdate | undefined;
  /** version téléchargée, vérifiée et prête à installer */
  let staged: { version: string; appPath: string } | undefined;
  let abort: AbortController | undefined;

  // ---- état et historique (même modèle que l'ancien programme) -------------
  const HISTORY_CAP = 32;
  let seq = 0;
  const history: Array<{ seq: number; snapshot: UpdaterSnapshot }> = [];
  const snapshot = (): UpdaterSnapshot => ({ state: current, justUpdatedFrom });
  const record = () => {
    seq += 1;
    history.push({ seq, snapshot: snapshot() });
    if (history.length > HISTORY_CAP) history.shift();
  };
  const setState = (next: UpdaterState) => {
    if (current.type !== "downloading" || next.type !== "downloading") {
      log("info", "Updater state", { from: current.type, to: next.type });
    }
    current = next;
    record();
  };

  void readPersistedValue<string>("app", ["appVersion"])
    .then((previous) => {
      if (
        previous != null &&
        semver.valid(previous) != null &&
        semver.valid(currentVersion) != null &&
        semver.gt(currentVersion, previous)
      ) {
        justUpdatedFrom = previous;
        record();
      }
    })
    .catch(() => undefined);

  // ---- vérification ----------------------------------------------------------
  let checking = false;
  const check = async (manual: boolean) => {
    if (checking || current.type === "downloading" || current.type === "disabled") return;
    checking = true;
    const before = current;
    if (manual) setState({ type: "checking", manual: true });
    try {
      const found = pickMacUpdate(await fetchReleases(), currentVersion, toChannel(channel));
      offered = found;
      if (found === undefined) {
        setState({ type: "idle" });
      } else if (staged?.version === found.version) {
        setState({
          type: "staged",
          version: found.version,
          kind: "update",
          releaseNotes: found.notesHtml,
        });
      } else {
        setState({ type: "available", version: found.version, releaseNotes: found.notesHtml });
      }
    } catch (err) {
      const message = getErrorMessageOrDefault(err);
      log(manual ? "warn" : "debug", "Update check failed", { error: message });
      // une vérification en arrière-plan qui échoue (hors ligne, par exemple) ne dit rien
      setState(
        manual
          ? { type: "error", message, manual: true }
          : before.type === "checking"
            ? { type: "idle" }
            : before,
      );
    } finally {
      checking = false;
    }
  };

  // ---- téléchargement ----------------------------------------------------------
  const download = async (update: IMacUpdate) => {
    const controller = new AbortController();
    abort = controller;
    setState({ type: "downloading", version: update.version, kind: "update", manual: true });
    const work = await mkdtemp(path.join(os.tmpdir(), "mortex-update-"));
    try {
      let expected = update.sha256;
      if (expected === undefined && update.sha256Url !== undefined) {
        const text = await (await fetch(update.sha256Url, { signal: controller.signal })).text();
        expected = parseSha256File(text);
      }
      if (expected === undefined) throw new Error("Empreinte SHA-256 introuvable");

      const zip = path.join(work, "mORTEX.zip");
      const response = await fetch(update.zipUrl, { signal: controller.signal });
      if (!response.ok || response.body === null)
        throw new Error(`Téléchargement : ${response.status}`);
      const total = Number(response.headers.get("content-length") ?? 0);
      let received = 0;
      const source = Readable.fromWeb(response.body as never);
      source.on("data", (chunk: Buffer) => {
        received += chunk.length;
        if (total > 0) {
          setState({
            type: "downloading",
            version: update.version,
            kind: "update",
            manual: true,
            percent: Math.min(99, Math.round((received / total) * 100)),
          });
        }
      });
      await pipeline(source, createWriteStream(zip), { signal: controller.signal });

      if ((await sha256Of(zip)) !== expected)
        throw new Error("Empreinte SHA-256 différente : fichier refusé");

      const unpacked = path.join(work, "app");
      await mkdir(unpacked);
      await run("/usr/bin/ditto", ["-xk", zip, unpacked]);
      const candidate = path.join(unpacked, "mORTEX.app");
      await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", candidate]);
      const plist = await run("/usr/bin/defaults", [
        "read",
        path.join(candidate, "Contents", "Info"),
        "CFBundleIdentifier",
      ]);
      if (plist.stdout.trim() !== BUNDLE_ID)
        throw new Error("Identifiant de l'appli inattendu : fichier refusé");
      const wanted = await run("/usr/bin/codesign", ["-dv", currentAppPath()]).catch(
        (e: { stderr?: string }) => e,
      );
      const got = await run("/usr/bin/codesign", ["-dv", candidate]).catch(
        (e: { stderr?: string }) => e,
      );
      const team = (out: { stderr?: string } | { stdout: string; stderr: string }) =>
        /TeamIdentifier=(\S+)/.exec(out.stderr ?? "")?.[1];
      if (team(wanted) !== undefined && team(wanted) !== team(got)) {
        throw new Error("Signature d'un autre éditeur : fichier refusé");
      }

      await rm(zip, { force: true });
      staged = { version: update.version, appPath: candidate };
      setState({
        type: "staged",
        version: update.version,
        kind: "update",
        releaseNotes: update.notesHtml,
      });
    } catch (err) {
      await rm(work, { recursive: true, force: true }).catch(() => undefined);
      if (controller.signal.aborted) {
        setState({ type: "idle" });
      } else {
        const message = getErrorMessageOrDefault(err);
        log("error", "Update download failed", { error: message });
        setState({
          type: "error",
          message,
          manual: true,
          retry: { version: update.version, releaseNotes: update.notesHtml },
        });
      }
    } finally {
      abort = undefined;
    }
  };

  // ---- installation (à la demande uniquement) ----------------------------------
  const installAndRestart = async () => {
    if (staged === undefined) return;
    const scriptDir = path.dirname(staged.appPath);
    const script = path.join(scriptDir, "install.sh");
    const trash = path.join(os.homedir(), ".Trash", `mORTEX ${currentVersion}.app`);
    await writeFile(script, installerScript(), { mode: 0o755 });
    log("info", "Restarting to install update", { version: staged.version });
    spawn("/bin/bash", [script, String(process.pid), staged.appPath, currentAppPath(), trash], {
      detached: true,
      stdio: "ignore",
    }).unref();
    app.quit();
  };

  // ---- IPC -----------------------------------------------------------------------
  betterIpcMain.handle(
    "updater:get-status",
    (_event, since?: number): UpdaterStatusResponse => ({
      seq,
      snapshot: snapshot(),
      changes:
        since == null
          ? []
          : history.filter((entry) => entry.seq > since).map((entry) => entry.snapshot),
    }),
  );

  betterIpcMain.handle("updater:get-update-changelog", async (): Promise<string | null> => {
    if (justUpdatedFrom == null) return null;
    try {
      const found = pickMacUpdate(await fetchReleases(), justUpdatedFrom, toChannel(channel));
      return found?.notesHtml ?? null;
    } catch {
      return null;
    }
  });

  betterIpcMain.on("updater:set-channel", (_event, next, manual) => {
    channel = next;
    abort?.abort();
    offered = undefined;
    if (next === "none") {
      setState({ type: "disabled" });
      return;
    }
    if (current.type === "disabled") setState({ type: "idle" });
    void check(manual === true);
  });

  betterIpcMain.on("updater:check-for-updates", (_event, next, manual) => {
    channel = next;
    void check(manual === true);
  });

  betterIpcMain.on("updater:download", () => {
    if (offered !== undefined && staged?.version !== offered.version) {
      void download(offered);
    } else if (staged !== undefined) {
      void installAndRestart();
    }
  });

  // pas de retour en arrière proposé sur Mac
  betterIpcMain.on("updater:download-downgrade", () => undefined);
  betterIpcMain.on("updater:decline-downgrade", () => setState({ type: "idle" }));
  betterIpcMain.on("updater:cancel-download", () => abort?.abort());
  betterIpcMain.on("updater:restart-and-install", () => void installAndRestart());

  setTimeout(() => void check(false), 15_000);
  setInterval(() => void check(false), CHECK_EVERY_MS);
  log("info", "Mac updater initialized", { repo: REPO });
}
