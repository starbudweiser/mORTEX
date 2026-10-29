/**
 * mORTEX (macOS) : logique de la page Éditeur de réglages, sans interface. Les valeurs en attente
 * (pas encore écrites) sont rangées par identifiant de réglage du catalogue ; une entrée n'existe que
 * si elle diffère de la valeur actuelle, donc le nombre d'entrées est le nombre de changements.
 */
import {
  GRAPHICS_SECTIONS,
  INI_FILE_NAMES,
  type IChange,
  type IEffectiveSetting,
  type IniRole,
  settingId,
} from "../../util/macos/iniEdit";
import type { ICatalogSetting } from "./catalog/types";

export type Pending = Readonly<Record<string, string>>;

export interface IValueContext {
  /** valeurs effectives lues dans les INI (readEffective) */
  effective: ReadonlyMap<string, IEffectiveSetting>;
  /** valeurs par défaut de Bethesda, par settingId, pour ce que les INI ne définissent pas */
  defaults: ReadonlyMap<string, string>;
  pending: Pending;
}

const idOf = (setting: ICatalogSetting) => settingId(setting.section, setting.key);

export const isTruthy = (value: string | undefined): boolean =>
  value !== undefined &&
  value.trim() !== "" &&
  value.trim() !== "0" &&
  value.toLowerCase() !== "false";

/** valeur dans les INI, sinon valeur par défaut de Bethesda, sinon rien */
export function baseValue(ctx: IValueContext, setting: ICatalogSetting): string | undefined {
  return ctx.effective.get(idOf(setting))?.value ?? ctx.defaults.get(idOf(setting));
}

/** valeur affichée : celle en attente, sinon la valeur actuelle */
export function currentValue(ctx: IValueContext, setting: ICatalogSetting): string | undefined {
  return ctx.pending[setting.id] ?? baseValue(ctx, setting);
}

/** deux valeurs sont les mêmes : égales, ou égales comme nombres (1.0000 et 1) */
export function sameValue(setting: ICatalogSetting, a: string | undefined, b: string | undefined) {
  if (a === undefined || b === undefined) return a === b;
  if (a.trim() === b.trim()) return true;
  if (setting.type === "int" || setting.type === "float") {
    const [x, y] = [Number(a), Number(b)];
    return a.trim() !== "" && b.trim() !== "" && Number.isFinite(x) && x === y;
  }
  return setting.type === "choice" ? a.trim().toLowerCase() === b.trim().toLowerCase() : false;
}

/** la valeur saisie est acceptable (nombre dans les bornes, choix connu) */
export function isValid(setting: ICatalogSetting, raw: string): boolean {
  const value = raw.trim();
  switch (setting.type) {
    case "bool":
      return value === "0" || value === "1";
    case "int":
    case "float": {
      const n = Number(value);
      if (value === "" || !Number.isFinite(n)) return false;
      if (setting.type === "int" && !Number.isInteger(n)) return false;
      return n >= (setting.min ?? -Infinity) && n <= (setting.max ?? Infinity);
    }
    case "choice":
      return value !== "";
    case "text":
      return value !== "";
  }
}

/** le réglage est-il utilisable, vu l'état du réglage dont il dépend ? */
export function isEnabled(
  ctx: IValueContext,
  setting: ICatalogSetting,
  catalog: readonly ICatalogSetting[],
): boolean {
  const dep = setting.dependsOn;
  if (dep === undefined) return true;
  const target = catalog.find((s) => s.id === dep.on);
  if (target === undefined) return true;
  const value = currentValue(ctx, target);
  if (dep.not !== undefined) return value !== undefined && !sameValue(target, value, dep.not);
  if (dep.value === undefined) return isTruthy(value);
  return value !== undefined && sameValue(target, value, dep.value);
}

/** fichier où le réglage sera écrit (règle de iniEdit.planChanges) */
export function targetRole(setting: ICatalogSetting, ctx: IValueContext): IniRole {
  return (
    ctx.effective.get(idOf(setting))?.role ??
    (GRAPHICS_SECTIONS.has(setting.section.toLowerCase()) ? "prefs" : "ini")
  );
}

/** la ligne exacte écrite, pour la bulle : « [Display] iShadowMapResolution=2048 → SkyrimPrefs.ini » */
export function writtenLine(setting: ICatalogSetting, value: string, ctx: IValueContext): string {
  return `[${setting.section}] ${setting.key}=${value} → ${INI_FILE_NAMES[targetRole(setting, ctx)]}`;
}

/** nouvelle valeur en attente pour un réglage ; revient à « inchangé » si elle égale la valeur actuelle */
export function withValue(ctx: IValueContext, setting: ICatalogSetting, value: string): Pending {
  const { [setting.id]: _removed, ...others } = ctx.pending;
  return sameValue(setting, value, baseValue(ctx, setting))
    ? others
    : { ...others, [setting.id]: value.trim() };
}

/** les changements à écrire, dans l'ordre du catalogue, au format de iniEdit */
export function pendingChanges(catalog: readonly ICatalogSetting[], pending: Pending): IChange[] {
  return catalog
    .filter((s) => pending[s.id] !== undefined)
    .map((s) => ({ section: s.section, key: s.key, value: pending[s.id] }));
}

/** applique un préréglage (liste de [section] clé=valeur) aux réglages du catalogue qu'il mentionne */
export function pendingFromPreset(
  catalog: readonly ICatalogSetting[],
  preset: readonly IChange[],
  ctx: IValueContext,
): Pending {
  const values = new Map(preset.map((c) => [settingId(c.section, c.key), c.value]));
  let pending: Pending = ctx.pending;
  for (const setting of catalog) {
    const value = values.get(idOf(setting));
    if (value !== undefined && isValid(setting, value)) {
      pending = withValue({ ...ctx, pending }, setting, value);
    }
  }
  return pending;
}
