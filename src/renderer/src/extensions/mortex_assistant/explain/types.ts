/**
 * mORTEX : structure commune des explications de l'Assistant. Produites par des fonctions pures
 * (plugin.ts, mod.ts), affichées par AssistantPanel. Les textes ne sont jamais écrits ici : seules
 * des clés de traduction et leurs paramètres.
 */
export type ExplanationSeverity = "info" | "warning" | "error";

export type ExplanationKind =
  | "plugin-dirty"
  | "plugin-clean"
  | "plugin-requirement"
  | "plugin-incompatible"
  | "plugin-master"
  | "plugin-esl"
  | "plugin-archive"
  | "plugin-empty"
  | "plugin-no-metadata"
  | "plugin-loot-message"
  | "plugin-tags"
  | "mod-conflict"
  | "mod-conflict-status"
  | "mod-nexus-requirement"
  | "mod-plugins";

export type SourceKind =
  | "loot-message"
  | "loot-meta"
  | "masters"
  | "conflict"
  | "nexus-requirement"
  | "mod-rule";

/** D'où vient un fait : de quoi le vérifier, jamais une affirmation sans origine. */
export interface ISourceRef {
  kind: SourceKind;
  label: string;
  detail?: string;
  url?: string;
}

/** Actions déjà présentes dans mORTEX : le panneau ne fait que les proposer. */
export type ExistingActionId = "open-conflict-editor" | "show-plugins";

export interface IExistingAction {
  id: ExistingActionId;
  labelKey: string;
}

export type ExplanationParams = Record<string, string | number | boolean>;

export interface IExplanationDetail {
  textKey: string;
  params: ExplanationParams;
  severity?: ExplanationSeverity;
}

export interface IExplanationItem {
  id: string;
  severity: ExplanationSeverity;
  kind: ExplanationKind;
  titleKey: string;
  textKey: string;
  params: ExplanationParams;
  /** Lignes complémentaires (classes de fichiers d'un conflit, par exemple). */
  details?: IExplanationDetail[];
  sources: ISourceRef[];
  actions?: IExistingAction[];
}

export const LOOT_ATTRIBUTION_URL = "https://github.com/loot/skyrimse";
export const LOOT_LICENSE_URL = "https://creativecommons.org/licenses/by-nc-sa/4.0/";

/** Vrai quand un texte ou un fait de la masterlist LOOT apparaît : l'attribution devient obligatoire. */
export const needsLootAttribution = (items: IExplanationItem[]): boolean =>
  items.some((item) =>
    item.sources.some((s) => s.kind === "loot-message" || s.kind === "loot-meta"),
  );

const RANK: Record<ExplanationSeverity, number> = { error: 0, warning: 1, info: 2 };

export const bySeverity = (lhs: IExplanationItem, rhs: IExplanationItem): number =>
  RANK[lhs.severity] - RANK[rhs.severity];
