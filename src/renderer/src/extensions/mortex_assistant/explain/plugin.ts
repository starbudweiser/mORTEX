import type { IPluginLoadOrderEntry } from "../../gamebryo_plugin_management/types/IPluginLoadOrderEntry";
import type { IPluginCombined, IPlugins } from "../../gamebryo_plugin_management/types/IPlugins";
import toPluginId from "../../gamebryo_plugin_management/util/toPluginId";
import type { IExplanationItem, ISourceRef } from "./types";

/** Ce que l'explication d'un plugin sait du reste de la liste. */
export interface IPluginExplainEnv {
  pluginList: IPlugins;
  loadOrder: { [id: string]: IPluginLoadOrderEntry };
  /** plugins natifs du jeu, en minuscules */
  natives: string[];
  language: string;
}

const PLUGIN_EXT = /\.(esp|esm|esl)$/i;

const LOOT_META_SOURCE: ISourceRef = { kind: "loot-meta", label: "LOOT masterlist" };

/** Le texte du message dans la langue de l'appli, sinon en anglais, sinon le premier. */
export function lootMessageText(
  content: string | Array<{ text: string; language: string }>,
  language: string,
): string {
  if (typeof content === "string") {
    return content;
  }
  const lang = language.split(/[-_]/)[0];
  return (
    content.find((c) => c.language === language)?.text ??
    content.find((c) => c.language.split(/[-_]/)[0] === lang)?.text ??
    content.find((c) => c.language === "en")?.text ??
    content[0]?.text ??
    ""
  );
}

/** Message LOOT qui demande l'attention de l'utilisateur (avertissement ou erreur). */
const isProblemMessage = (type: number) => type === 1 || type === 2;

/** Vrai si LOOT signale quelque chose : plugin sale ou message d'avertissement/erreur. */
export function hasLootProblem(plugin: {
  dirtyness?: unknown[];
  messages?: Array<{ type: number }>;
}): boolean {
  return (
    (plugin.dirtyness?.length ?? 0) > 0 ||
    (plugin.messages ?? []).some((m) => isProblemMessage(m.type))
  );
}

type Availability = "ok" | "missing" | "disabled";

function availability(env: IPluginExplainEnv, name: string): Availability {
  const id = toPluginId(name);
  if (env.natives.includes(id)) {
    return "ok";
  }
  if (env.pluginList[id] === undefined) {
    return "missing";
  }
  return env.loadOrder[id]?.enabled === true ? "ok" : "disabled";
}

/**
 * Explique ce qui se passe pour un plugin à partir des données déjà calculées par LOOT et par la
 * liste de plugins. Fonction pure : aucun tri, aucun accès disque, aucun réseau.
 */
export function explainPlugin(plugin: IPluginCombined, env: IPluginExplainEnv): IExplanationItem[] {
  const items: IExplanationItem[] = [];
  const name = plugin.name;
  const enabled = env.natives.includes(plugin.id) || env.loadOrder[plugin.id]?.enabled === true;

  // masters manquants ou désactivés (la liste est lue dans l'en-tête du plugin)
  const masters: Array<{ master: string; state: Availability }> = (plugin.masterList ?? [])
    .map((master) => ({ master, state: availability(env, master) }))
    .filter((m) => m.state !== "ok");
  for (const { master, state } of masters) {
    items.push({
      id: `master:${toPluginId(master)}`,
      severity: state === "missing" || enabled ? "error" : "warning",
      kind: "plugin-master",
      titleKey: state === "missing" ? "Missing master" : "Disabled master",
      textKey:
        state === "missing"
          ? "{{plugin}} needs {{master}}, which is not installed. The game will not start correctly, or will crash, until it is installed."
          : "{{plugin}} needs {{master}}, which is installed but disabled. Enable it, or disable {{plugin}}.",
      params: { plugin: name, master },
      sources: [
        {
          kind: "masters",
          label: "Masters in the plugin header",
          detail: (plugin.masterList ?? []).join(", "),
        },
      ],
    });
  }

  // plugin sale
  const dirty = plugin.dirtyness ?? [];
  if (dirty.length > 0) {
    const d = dirty[0];
    items.push({
      id: "dirty",
      severity: "warning",
      kind: "plugin-dirty",
      titleKey: "Plugin needs cleaning",
      textKey:
        "LOOT reports {{itm}} identical-to-master records (ITM), {{udr}} deleted references (UDR) and {{nav}} deleted navmeshes. ITM are copies of the master's records that change nothing but can override other mods; UDR and deleted navmeshes can cause crashes. Clean it with {{utility}}.",
      params: {
        itm: d.itmCount,
        udr: d.deletedReferenceCount,
        nav: d.deletedNavmeshCount,
        utility: d.cleaningUtility || "xEdit",
      },
      sources: [{ ...LOOT_META_SOURCE, detail: `CRC ${d.crc.toString(16).toUpperCase()}` }],
    });
  } else if ((plugin.cleanliness ?? []).length > 0) {
    items.push({
      id: "clean",
      severity: "info",
      kind: "plugin-clean",
      titleKey: "Plugin already cleaned",
      textKey: "LOOT knows this version of {{plugin}} as cleaned: nothing to do.",
      params: { plugin: name },
      sources: [LOOT_META_SOURCE],
    });
  }

  // exigences : absentes ou inactives
  for (const req of plugin.requirements ?? []) {
    if (!PLUGIN_EXT.test(req.name)) {
      items.push({
        id: `req:${req.name}`,
        severity: "info",
        kind: "plugin-requirement",
        titleKey: "Requirement mORTEX cannot check",
        textKey:
          "LOOT says {{plugin}} requires {{requirement}}, which is not a plugin: check by hand that it is installed.",
        params: { plugin: name, requirement: req.display || req.name },
        sources: [{ ...LOOT_META_SOURCE, detail: req.condition }],
      });
      continue;
    }
    const state = availability(env, req.name);
    if (state !== "ok") {
      items.push({
        id: `req:${toPluginId(req.name)}`,
        severity: "warning",
        kind: "plugin-requirement",
        titleKey: state === "missing" ? "Missing requirement" : "Inactive requirement",
        textKey:
          state === "missing"
            ? "LOOT says {{plugin}} requires {{requirement}}, which is not installed."
            : "LOOT says {{plugin}} requires {{requirement}}, which is installed but disabled.",
        params: { plugin: name, requirement: req.display || req.name },
        sources: [{ ...LOOT_META_SOURCE, detail: req.condition }],
      });
    }
  }

  // incompatibilités actives
  for (const inc of plugin.incompatibilities ?? []) {
    if (
      PLUGIN_EXT.test(inc.name) &&
      availability(env, inc.name) === "ok" &&
      !env.natives.includes(toPluginId(inc.name))
    ) {
      items.push({
        id: `inc:${toPluginId(inc.name)}`,
        severity: "error",
        kind: "plugin-incompatible",
        titleKey: "Incompatible plugin enabled",
        textKey:
          "LOOT says {{plugin}} is incompatible with {{other}}, and both are enabled. Disable one of them.",
        params: { plugin: name, other: inc.display || inc.name },
        sources: [{ ...LOOT_META_SOURCE, detail: inc.condition }],
      });
    }
  }

  if (plugin.isValidAsLightPlugin && !plugin.isLight && !plugin.isMedium) {
    items.push({
      id: "esl",
      severity: "info",
      kind: "plugin-esl",
      titleKey: "Can be flagged as ESL",
      textKey:
        "LOOT finds that {{plugin}} could be a light plugin (ESL). That frees a slot among the 255 regular plugins; the change is optional.",
      params: { plugin: name },
      sources: [LOOT_META_SOURCE],
    });
  }

  if (plugin.loadsArchive) {
    items.push({
      id: "archive",
      severity: "info",
      kind: "plugin-archive",
      titleKey: "Loads an archive",
      textKey:
        "{{plugin}} loads a BSA archive of the same name. Its files are overridden by loose files from other mods.",
      params: { plugin: name },
      sources: [LOOT_META_SOURCE],
    });
  }

  if (plugin.isEmpty) {
    items.push({
      id: "empty",
      severity: "info",
      kind: "plugin-empty",
      titleKey: "Empty plugin",
      textKey:
        "{{plugin}} contains no record. It is usually kept only to load its archive, or to satisfy a master.",
      params: { plugin: name },
      sources: [LOOT_META_SOURCE],
    });
  }

  const messages = plugin.messages ?? [];
  // message synthétique d'mORTEX (type -1) quand LOOT n'a aucune entrée pour ce plugin
  if (messages.some((m) => m.type === -1)) {
    items.push({
      id: "no-metadata",
      severity: "info",
      kind: "plugin-no-metadata",
      titleKey: "No LOOT metadata",
      textKey:
        "The LOOT masterlist has no entry for {{plugin}}. That is usually fine: the plugin is simply not known. You may have to choose a group for it so that LOOT sorts it correctly.",
      params: { plugin: name },
      sources: [LOOT_META_SOURCE],
    });
  }

  messages.forEach((msg, idx) => {
    if (msg.type < 0) {
      return;
    }
    items.push({
      id: `msg:${idx}`,
      severity: msg.type === 2 ? "error" : msg.type === 1 ? "warning" : "info",
      kind: "plugin-loot-message",
      titleKey:
        msg.type === 2
          ? "LOOT error message"
          : msg.type === 1
            ? "LOOT warning message"
            : "LOOT note",
      textKey:
        msg.type === 2
          ? "LOOT considers this a serious problem. Message quoted as is:"
          : msg.type === 1
            ? "LOOT asks for your attention. Message quoted as is:"
            : "Information from LOOT. Message quoted as is:",
      params: { quote: lootMessageText(msg.content, env.language) },
      sources: [
        {
          kind: "loot-message",
          label: "LOOT message",
          detail: ["say", "warn", "error"][msg.type] ?? String(msg.type),
        },
      ],
    });
  });

  const suggested = (plugin.suggestedTags ?? []).filter((t) => t.isAddition);
  if (suggested.length > 0) {
    items.push({
      id: "tags",
      severity: "info",
      kind: "plugin-tags",
      titleKey: "Suggested Bash tags",
      textKey:
        "LOOT suggests these Bash tags, which tell Wrye Bash how to merge this plugin: {{tags}}.",
      params: { tags: suggested.map((t) => t.name).join(", ") },
      sources: [LOOT_META_SOURCE],
    });
  }

  return items;
}
