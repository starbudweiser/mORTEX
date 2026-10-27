/**
 * mORTEX : au lancement du jeu, le script extender (SKSE…) écrit dans son journal les plugins
 * qu'il refuse, sans rien en dire à l'écran. mORTEX surveille ce journal et prévient : quels
 * plugins, pourquoi, en clair, et le correctif quand il est connu (Address Library à activer ou
 * à installer).
 *
 * Le journal est relu quelques secondes après sa dernière écriture ; celui trouvé au démarrage de
 * mORTEX ne déclenche rien (il date d'une partie déjà signalée ou passée).
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { log } from "../../logging";
import type { IExtensionApi, IExtensionContext } from "../../types/IExtensionContext";
import getVortexPath from "../../util/getVortexPath";
import {
  type IRefusedPlugin,
  type RefusalKind,
  parseScriptExtenderLog,
  SCRIPT_EXTENDER_LOGS,
} from "../../util/macos/skseLog";
import type { IMod } from "../mod_management/types/IMod";
import { setModsEnabled } from "../profile_management/actions/profiles";
import { activeGameId, activeProfile } from "../profile_management/selectors";

const POLL_MS = 3000;
const SETTLE_MS = 8000;
const NOTIFICATION_ID = "script-extender-refused";

/** Address Library for SKSE Plugins, par jeu (id Nexus) */
const ADDRESS_LIBRARY: Record<string, { modId: number; url: string }> = {
  skyrimse: {
    modId: 32444,
    url: "https://www.nexusmods.com/skyrimspecialedition/mods/32444",
  },
};

const EXPLANATIONS: Record<RefusalKind, string> = {
  "address-library":
    "Address Library for SKSE Plugins is missing or doesn't match your game version.",
  runtime: "Built for another version of the game.",
  "extender-version": "Needs a newer version of the script extender.",
  "missing-dependency":
    "A DLL it needs is missing, often a Visual C++ runtime that the bottle doesn't have.",
  "not-a-plugin": "Not a script extender plugin, or not a 64-bit DLL.",
  other: "The script extender says: {{reason}}",
};

function addressLibraryMod(api: IExtensionApi, gameId: string): IMod | undefined {
  const known = ADDRESS_LIBRARY[gameId];
  if (known === undefined) return undefined;
  const mods: Record<string, IMod> = api.getState().persistent.mods[gameId] ?? {};
  return Object.values(mods).find(
    (mod) => Number(mod.attributes?.modId) === known.modId && mod.state === "installed",
  );
}

function report(api: IExtensionApi, gameId: string, refused: IRefusedPlugin[]): void {
  const t = (text: string, options?: Record<string, unknown>) =>
    api.translate(text, { ns: "common", ...options });
  const actions: Array<{ title: string; action: (dismiss: () => void) => void }> = [];

  const known = ADDRESS_LIBRARY[gameId];
  if (known !== undefined && refused.some((entry) => entry.kind === "address-library")) {
    const mod = addressLibraryMod(api, gameId);
    const profile = activeProfile(api.getState());
    if (
      mod !== undefined &&
      profile !== undefined &&
      profile.modState?.[mod.id]?.enabled !== true
    ) {
      actions.push({
        title: "Enable Address Library",
        action: (dismiss) => {
          setModsEnabled(api, profile.id, [mod.id], true);
          dismiss();
        },
      });
    } else if (mod === undefined) {
      actions.push({
        title: "Get Address Library",
        action: () => window.api.shell.openUrl(known.url),
      });
    }
  }

  actions.push({
    title: "More",
    action: () => {
      const lines = refused.map(
        (entry) =>
          `[b]${entry.plugin}[/b]: ${t(EXPLANATIONS[entry.kind], { replace: { reason: entry.reason } })}`,
      );
      api.showDialog?.(
        "info",
        "Plugins refused by the script extender",
        {
          bbcode: `${t("These plugins didn't load, so their mods don't work in game:")}[br][/br][br][/br]${lines.join("[br][/br]")}`,
        },
        [{ label: "Close" }],
      );
    },
  });

  api.sendNotification?.({
    id: NOTIFICATION_ID,
    type: "warning",
    title: SCRIPT_EXTENDER_LOGS[gameId]?.name ?? "Script extender",
    message: "Plugins not loaded: {{count}}",
    replace: { count: refused.length },
    actions,
  });
}

function watch(api: IExtensionApi): () => void {
  let watched: string | undefined;
  let lastSeen = 0;
  let settle: NodeJS.Timeout | undefined;

  const check = (file: string) => {
    fs.promises
      .readFile(file, "latin1")
      .then((text) => {
        const gameId = activeGameId(api.getState());
        const { refused, loaded } = parseScriptExtenderLog(text);
        log("info", "script extender log read", { loaded: loaded.length, refused: refused.length });
        if (refused.length > 0) {
          report(api, gameId, refused);
        } else {
          api.dismissNotification?.(NOTIFICATION_ID);
        }
      })
      .catch((err) =>
        log("warn", "failed to read script extender log", { error: (err as Error).message }),
      );
  };

  const onPoll = (current: fs.Stats) => {
    if (watched === undefined || current.mtimeMs <= lastSeen) return;
    lastSeen = current.mtimeMs;
    const file = watched;
    clearTimeout(settle);
    settle = setTimeout(() => check(file), SETTLE_MS);
  };

  const follow = () => {
    const known = SCRIPT_EXTENDER_LOGS[activeGameId(api.getState())];
    const file =
      known === undefined
        ? undefined
        : path.join(getVortexPath("documents"), "My Games", known.folder, known.name, known.log);
    if (file === watched) return;
    if (watched !== undefined) fs.unwatchFile(watched, onPoll);
    watched = file;
    if (file === undefined) return;
    // le journal déjà là date d'avant : seul le prochain lancement compte
    try {
      lastSeen = fs.statSync(file).mtimeMs;
    } catch {
      lastSeen = 0;
    }
    fs.watchFile(file, { interval: POLL_MS, persistent: false }, onPoll);
  };

  follow();
  api.events.on("gamemode-activated", follow);
  return follow;
}

function init(context: IExtensionContext): boolean {
  context.once(() => {
    watch(context.api);
  });
  return true;
}

export default init;
