import type { IModMissingRequirements } from "../../health_check/types";
import type { IMod, IModRule } from "../../mod_management/types/IMod";
import { hasLootProblem } from "./plugin";
import type {
  ExplanationSeverity,
  IExplanationDetail,
  IExplanationItem,
  ISourceRef,
} from "./types";

/** Un conflit de fichiers tel que le gestionnaire de dépendances le stocke (IConflict). */
export interface IModConflict {
  otherMod: { id: string; name?: string; version?: string };
  files: string[];
  suggestion: "before" | "after" | null;
}

export type FileClass =
  | "scripts"
  | "plugins"
  | "skse"
  | "interface"
  | "textures"
  | "meshes"
  | "sounds"
  | "ini"
  | "other";

const CLASS_SEVERITY: Record<FileClass, ExplanationSeverity> = {
  scripts: "warning",
  plugins: "warning",
  skse: "warning",
  interface: "warning",
  textures: "info",
  meshes: "info",
  sounds: "info",
  ini: "info",
  other: "info",
};

/** Ordre d'affichage : le plus risqué d'abord. */
const CLASS_ORDER: FileClass[] = [
  "plugins",
  "skse",
  "scripts",
  "interface",
  "ini",
  "textures",
  "meshes",
  "sounds",
  "other",
];

export const CLASS_LABEL: Record<FileClass, string> = {
  scripts: "Scripts",
  plugins: "Plugins",
  skse: "SKSE DLLs",
  interface: "Interface",
  textures: "Textures",
  meshes: "Meshes",
  sounds: "Sounds",
  ini: "INI files",
  other: "Other files",
};

export function classifyFile(relPath: string): FileClass {
  const p = relPath.replace(/\\/g, "/").toLowerCase();
  const ext = p.slice(p.lastIndexOf(".") + 1);
  if (ext === "pex" || ext === "psc") return "scripts";
  if (ext === "esp" || ext === "esm" || ext === "esl") return "plugins";
  if (ext === "dll") return "skse";
  if (ext === "swf" || p.startsWith("interface/")) return "interface";
  if (ext === "ini") return "ini";
  if (ext === "dds" || p.startsWith("textures/")) return "textures";
  if (ext === "nif" || p.startsWith("meshes/")) return "meshes";
  if (["wav", "xwm", "fuz", "lip", "ogg"].includes(ext) || p.startsWith("sound/")) return "sounds";
  return "other";
}

const SEVERITY_RANK: Record<ExplanationSeverity, number> = { error: 0, warning: 1, info: 2 };

/** Un plugin du mod, avec ce que LOOT en sait déjà. */
export interface IModPluginInfo {
  name: string;
  messages?: Array<{ type: number }>;
  dirtyness?: unknown[];
}

export interface IModExplainEnv {
  /** state.session.dependencies.conflicts, undefined tant que le calcul n'a pas eu lieu */
  conflicts: { [modId: string]: IModConflict[] } | undefined;
  mods: { [modId: string]: Pick<IMod, "id" | "rules" | "attributes"> };
  nexus: {
    loggedIn: boolean;
    /** vrai quand le health check des exigences a rendu un résultat */
    checked: boolean;
    requirements?: IModMissingRequirements;
  };
  plugins: IModPluginInfo[];
}

const MAX_CONFLICT_MODS = 10;

const modName = (env: IModExplainEnv, c: IModConflict): string =>
  c.otherMod.name ??
  env.mods[c.otherMod.id]?.attributes?.customFileName ??
  env.mods[c.otherMod.id]?.attributes?.name ??
  c.otherMod.id;

const refersTo = (rule: IModRule, id: string) =>
  rule.reference.id === id || rule.reference.idHint === id;

/**
 * Qui gagne selon les règles : « self » si ce mod, « other » si l'autre, undefined sans règle ou
 * si les règles se contredisent. before = déployé avant l'autre (l'autre l'emporte).
 */
export function ruleWinner(
  mod: Pick<IMod, "id" | "rules">,
  other: Pick<IMod, "id" | "rules"> | undefined,
): { winner: "self" | "other" | undefined; rules: string[] } {
  const votes = new Set<"self" | "other">();
  const rules: string[] = [];
  const add = (owner: string, rule: IModRule, selfIsOwner: boolean) => {
    if (rule.ignored === true || (rule.type !== "before" && rule.type !== "after")) {
      return;
    }
    const ownerWins = rule.type === "after";
    votes.add(ownerWins === selfIsOwner ? "self" : "other");
    rules.push(`${owner} ${rule.type}`);
  };
  for (const rule of mod.rules ?? []) {
    if (other !== undefined && refersTo(rule, other.id)) add(mod.id, rule, true);
  }
  for (const rule of other?.rules ?? []) {
    if (refersTo(rule, mod.id)) add(other.id, rule, false);
  }
  return { winner: votes.size === 1 ? [...votes][0] : undefined, rules };
}

/** Explique les conflits de fichiers, les exigences Nexus et les plugins d'un mod. Fonction pure. */
export function explainMod(mod: IMod, env: IModExplainEnv): IExplanationItem[] {
  const items: IExplanationItem[] = [];

  // conflits de fichiers
  const conflicts = env.conflicts?.[mod.id] ?? [];
  if (env.conflicts === undefined) {
    items.push({
      id: "conflicts-unknown",
      severity: "info",
      kind: "mod-conflict-status",
      titleKey: "File conflicts not calculated yet",
      textKey:
        "mORTEX has not calculated file conflicts in this session. They are computed after a deployment, or from the conflict editor; the Assistant never starts that calculation.",
      params: {},
      sources: [{ kind: "conflict", label: "File conflict calculation" }],
      actions: [{ id: "open-conflict-editor", labelKey: "Manage file conflicts" }],
    });
  } else if (conflicts.length === 0) {
    items.push({
      id: "conflicts-none",
      severity: "info",
      kind: "mod-conflict-status",
      titleKey: "No file conflict",
      textKey: "No other enabled mod provides the same files as this one.",
      params: {},
      sources: [{ kind: "conflict", label: "File conflict calculation" }],
    });
  }

  const perMod = conflicts.map((c) => {
    const classes = new Map<FileClass, string[]>();
    for (const file of c.files) {
      const cls = classifyFile(file);
      classes.set(cls, [...(classes.get(cls) ?? []), file]);
    }
    const ordered = CLASS_ORDER.filter((cls) => classes.has(cls));
    const severity = ordered.reduce<ExplanationSeverity>(
      (acc, cls) =>
        SEVERITY_RANK[CLASS_SEVERITY[cls]] < SEVERITY_RANK[acc] ? CLASS_SEVERITY[cls] : acc,
      "info",
    );
    return { c, classes, ordered, severity };
  });
  perMod.sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.c.files.length - a.c.files.length,
  );

  for (const { c, classes, ordered, severity } of perMod.slice(0, MAX_CONFLICT_MODS)) {
    const other = env.mods[c.otherMod.id];
    const name = modName(env, c);
    const { winner, rules } = ruleWinner(mod, other);
    const details: IExplanationDetail[] = ordered.map((cls) => ({
      textKey: "{{label}}: {{count}} file(s), for example {{example}}",
      params: {
        label: CLASS_LABEL[cls],
        count: classes.get(cls)!.length,
        example: classes.get(cls)![0],
      },
      severity: CLASS_SEVERITY[cls],
    }));
    const sources: ISourceRef[] = [
      {
        kind: "conflict",
        label: "File conflict calculation",
        detail: `${c.files.length}`,
      },
    ];
    if (rules.length > 0) {
      sources.push({ kind: "mod-rule", label: "Mod rule", detail: rules.join(", ") });
    }
    items.push({
      id: `conflict:${c.otherMod.id}`,
      severity,
      kind: "mod-conflict",
      titleKey: "Files in common with {{mod}}",
      textKey:
        winner === "self"
          ? "A rule makes this mod win: its files replace those of {{mod}}."
          : winner === "other"
            ? "A rule makes {{mod}} win: its files replace those of this mod."
            : "No rule: the order is not defined, so which mod's files are used depends on the deployment order.",
      params: { mod: name, count: c.files.length },
      details,
      sources,
      actions: [{ id: "open-conflict-editor", labelKey: "Manage file conflicts" }],
    });
  }
  if (perMod.length > MAX_CONFLICT_MODS) {
    items.push({
      id: "conflicts-more",
      severity: "info",
      kind: "mod-conflict-status",
      titleKey: "More conflicts",
      textKey: "{{count}} more mods share files with this one; the conflict editor lists them all.",
      params: { count: perMod.length - MAX_CONFLICT_MODS },
      sources: [{ kind: "conflict", label: "File conflict calculation" }],
      actions: [{ id: "open-conflict-editor", labelKey: "Manage file conflicts" }],
    });
  }

  // exigences Nexus (lues dans le health check, jamais demandées au réseau)
  if (mod.attributes?.source === "nexus") {
    const { loggedIn, checked, requirements } = env.nexus;
    if (!loggedIn) {
      items.push({
        id: "nexus-unverified",
        severity: "info",
        kind: "mod-nexus-requirement",
        titleKey: "Nexus requirements not verified",
        textKey:
          "Not verified: a Nexus connection is required to check the requirements of this mod.",
        params: {},
        sources: [{ kind: "nexus-requirement", label: "Nexus requirements check" }],
      });
    } else if (!checked) {
      items.push({
        id: "nexus-not-run",
        severity: "info",
        kind: "mod-nexus-requirement",
        titleKey: "Nexus requirements not verified",
        textKey: "Not verified yet: the requirements check has not run in this session.",
        params: {},
        sources: [{ kind: "nexus-requirement", label: "Nexus requirements check" }],
      });
    } else {
      for (const req of requirements?.missingMods ?? []) {
        items.push({
          id: `nexus:${req.uid}`,
          severity: "warning",
          kind: "mod-nexus-requirement",
          titleKey: "Missing requirement on Nexus",
          textKey:
            "The Nexus page of this mod lists {{requirement}} as a requirement, and it is not installed.",
          params: { requirement: req.modName },
          sources: [
            {
              kind: "nexus-requirement",
              label: "Nexus requirements check",
              detail: req.modName,
              url: req.modUrl,
            },
          ],
        });
      }
      for (const dlc of requirements?.dlcRequirements ?? []) {
        items.push({
          id: `dlc:${dlc.dlcId ?? dlc.name}`,
          severity: "info",
          kind: "mod-nexus-requirement",
          titleKey: "DLC requirement",
          textKey:
            "This mod lists {{dlc}} as a requirement; mORTEX cannot verify DLC automatically.",
          params: { dlc: dlc.name },
          sources: [{ kind: "nexus-requirement", label: "Nexus requirements check" }],
        });
      }
    }
  }

  // plugins du mod avec un problème LOOT
  const flagged = env.plugins.filter((p) => hasLootProblem(p));
  if (flagged.length > 0) {
    items.push({
      id: "plugins-loot",
      severity: "warning",
      kind: "mod-plugins",
      titleKey: "Plugins with a LOOT problem",
      textKey: "{{count}} plugin(s) of this mod have a LOOT warning or need cleaning: {{names}}.",
      params: { count: flagged.length, names: flagged.map((p) => p.name).join(", ") },
      sources: [{ kind: "loot-meta", label: "LOOT masterlist" }],
      actions: [{ id: "show-plugins", labelKey: "Show plugins" }],
    });
  }

  return items;
}
