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

/** réglage hors catalogue, modifié depuis la page Avancé : section et clé dans la clé d'attente */
export const RAW_PREFIX = "raw:";

export const rawKey = (section: string, key: string) => `${RAW_PREFIX}${section}\u0000${key}`;

function parseRawKey(pendingKey: string): { section: string; key: string } | undefined {
  if (!pendingKey.startsWith(RAW_PREFIX)) return undefined;
  const [section, key] = pendingKey.slice(RAW_PREFIX.length).split("\u0000");
  return key === undefined ? undefined : { section, key };
}

/** les changements à écrire : ceux du catalogue dans son ordre, puis ceux de la page Avancé */
export function pendingChanges(catalog: readonly ICatalogSetting[], pending: Pending): IChange[] {
  const fromCatalog = catalog
    .filter((s) => pending[s.id] !== undefined)
    .map((s) => ({ section: s.section, key: s.key, value: pending[s.id] }));
  const raw = Object.entries(pending).flatMap(([pendingKey, value]) => {
    const parsed = parseRawKey(pendingKey);
    return parsed === undefined ? [] : [{ ...parsed, value }];
  });
  return [...fromCatalog, ...raw];
}

/** type d'un réglage libre, d'après le préfixe de son nom (bFoo, iFoo, uFoo, fFoo, sFoo) */
export function valueKind(key: string): "bool" | "int" | "float" | "text" {
  switch (key[0]) {
    case "b":
      return "bool";
    case "i":
    case "u":
      return "int";
    case "f":
      return "float";
    default:
      return "text";
  }
}

/** valeur acceptable pour un réglage libre : sans bornes, mais du bon type */
export function isValidRaw(key: string, raw: string): boolean {
  const value = raw.trim();
  if (value === "") return false;
  switch (valueKind(key)) {
    case "bool":
      return value === "0" || value === "1";
    case "int":
      return /^-?\d+$/.test(value);
    case "float":
      return Number.isFinite(Number(value));
    case "text":
      return true;
  }
}

/** valeur actuelle d'un réglage libre : INI, sinon valeur par défaut de Bethesda */
export function rawBase(ctx: IValueContext, section: string, key: string): string | undefined {
  return (
    ctx.effective.get(settingId(section, key))?.value ?? ctx.defaults.get(settingId(section, key))
  );
}

/**
 * Nouvelle valeur en attente pour un réglage de la page Avancé : sous l'identifiant du catalogue
 * s'il y est (une seule entrée par réglage), sinon sous une clé libre.
 */
export function withEntryValue(
  ctx: IValueContext,
  catalog: readonly ICatalogSetting[],
  section: string,
  key: string,
  value: string,
): Pending {
  const known = catalog.find((s) => settingId(s.section, s.key) === settingId(section, key));
  if (known !== undefined) return withValue(ctx, known, value);
  const pendingKey = rawKey(section, key);
  const { [pendingKey]: _removed, ...others } = ctx.pending;
  const base = rawBase(ctx, section, key);
  const same =
    base !== undefined &&
    (base.trim() === value.trim() ||
      (valueKind(key) !== "text" &&
        value.trim() !== "" &&
        Number.isFinite(Number(base)) &&
        Number(base) === Number(value)));
  return same ? others : { ...others, [pendingKey]: value.trim() };
}

/** la valeur en attente d'un réglage de la page Avancé, s'il y en a une */
export function pendingEntryValue(
  ctx: IValueContext,
  catalog: readonly ICatalogSetting[],
  section: string,
  key: string,
): string | undefined {
  const known = catalog.find((s) => settingId(s.section, s.key) === settingId(section, key));
  return known !== undefined ? ctx.pending[known.id] : ctx.pending[rawKey(section, key)];
}

export interface IAdvancedEntry {
  section: string;
  key: string;
  /** le nom figure dans SkyrimSE.exe */
  known: boolean;
}

/** tous les réglages à montrer : ceux de l'exécutable, plus ceux des INI qu'il ne connaît pas */
export function advancedEntries(
  exe: ReadonlyArray<readonly [string, string]>,
  effective: ReadonlyMap<string, IEffectiveSetting>,
): IAdvancedEntry[] {
  const entries = new Map<string, IAdvancedEntry>();
  for (const [section, key] of exe)
    entries.set(settingId(section, key), { section, key, known: true });
  for (const [id, setting] of effective) {
    if (!entries.has(id)) {
      entries.set(id, { section: setting.section, key: setting.key, known: false });
    }
  }
  return [...entries.values()].sort(
    (a, b) =>
      a.section.toLowerCase().localeCompare(b.section.toLowerCase()) ||
      a.key.toLowerCase().localeCompare(b.key.toLowerCase()),
  );
}

export interface IAdvancedFilter {
  query: string;
  /** seulement les réglages définis dans les INI (ou modifiés en attente) */
  onlyDefined: boolean;
}

export function filterEntries(
  entries: readonly IAdvancedEntry[],
  ctx: IValueContext,
  catalog: readonly ICatalogSetting[],
  filter: IAdvancedFilter,
): IAdvancedEntry[] {
  const words = filter.query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w !== "");
  return entries.filter((entry) => {
    const defined =
      ctx.effective.has(settingId(entry.section, entry.key)) ||
      pendingEntryValue(ctx, catalog, entry.section, entry.key) !== undefined;
    if (filter.onlyDefined && !defined) return false;
    const haystack =
      `${entry.section} ${entry.key} ${rawBase(ctx, entry.section, entry.key) ?? ""}`.toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
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

/** nombre saisi avec une virgule ou un point : toujours un point dans l'INI */
export const normalizeNumber = (raw: string) => raw.trim().replace(",", ".");

/** nombre sans zéros inutiles (10000.0000 → 10000) pour l'affichage ; le reste tel quel */
export function formatNumber(value: string | undefined): string {
  if (value === undefined) return "";
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) ? String(n) : value;
}
