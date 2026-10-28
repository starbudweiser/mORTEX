/**
 * mORTEX : filtres du navigateur Nexus (colonne de gauche, comme sur nexusmods.com), traduits en
 * filtres de l'API GraphQL v2.
 *
 * Interface :
 *  - IBrowseFilters, EMPTY_FILTERS, activeFilterCount(filters)
 *  - modClauses(filters, now) / collectionClauses(filters)  tout sauf les catégories
 *  - categoryClause(field, categories)                      une catégorie OU une autre
 *
 * Les catégories restent à part : leurs compteurs se calculent sans elles, pour qu'en cocher une
 * laisse voir combien chacune des autres ajouterait.
 *
 * Règles de l'API vérifiées le 29/10/2026 : plusieurs valeurs d'un même champ se cumulent (ET),
 * un « OU » demande un filtre imbriqué { op: "OR", champ: [...] } ; les dates sont en secondes ;
 * fileSize est en Kio ; recentRating va de 0 à 100.
 */

export type UpdatedWithin = "" | "day" | "week" | "month" | "year";

export interface IBrowseFilters {
  categories: string[];
  tagsInclude: string[];
  tagsExclude: string[];
  // mods
  description: string;
  author: string;
  uploader: string;
  languages: string[];
  minDownloads: string;
  minEndorsements: string;
  minSizeMB: string;
  maxSizeMB: string;
  updatedWithin: UpdatedWithin;
  onlyUpdated: boolean;
  // collections
  gameVersions: string[];
  minRating: string;
  withBadge: boolean;
}

export const EMPTY_FILTERS: IBrowseFilters = {
  categories: [],
  tagsInclude: [],
  tagsExclude: [],
  description: "",
  author: "",
  uploader: "",
  languages: [],
  minDownloads: "",
  minEndorsements: "",
  minSizeMB: "",
  maxSizeMB: "",
  updatedWithin: "",
  onlyUpdated: false,
  gameVersions: [],
  minRating: "",
  withBadge: false,
};

type Clause = Record<string, unknown>;

const SECONDS: Record<Exclude<UpdatedWithin, "">, number> = {
  day: 86_400,
  week: 7 * 86_400,
  month: 30 * 86_400,
  year: 365 * 86_400,
};

const equals = (value: string) => ({ value, op: "EQUALS" });

/** Nexus refuse une recherche d'un seul caractère : on l'ignore jusqu'au suivant */
const usableText = (text: string): string | undefined => {
  const trimmed = text.trim();
  return trimmed.length >= 2 ? trimmed : undefined;
};

const positiveNumber = (text: string): number | undefined => {
  const value = Number(text.replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value > 0 ? value : undefined;
};

function tagClauses(filters: IBrowseFilters): Clause[] {
  const clauses: Clause[] = [];
  if (filters.tagsInclude.length > 0) clauses.push({ tag: filters.tagsInclude.map(equals) });
  if (filters.tagsExclude.length > 0) {
    clauses.push({ tag: filters.tagsExclude.map((value) => ({ value, op: "NOT_EQUALS" })) });
  }
  return clauses;
}

function anyOf(field: string, values: string[]): Clause[] {
  return values.length > 0 ? [{ op: "OR", [field]: values.map(equals) }] : [];
}

export function categoryClause(field: string, categories: string[]): Clause[] {
  return anyOf(field, categories);
}

export function modClauses(filters: IBrowseFilters, now: number = Date.now()): Clause[] {
  const clauses = tagClauses(filters);
  const description = usableText(filters.description);
  if (description) clauses.push({ description: [{ value: description, op: "MATCHES" }] });
  const author = usableText(filters.author);
  if (author) clauses.push({ author: [{ value: author, op: "WILDCARD" }] });
  const uploader = usableText(filters.uploader);
  if (uploader) clauses.push({ uploader: [{ value: uploader, op: "WILDCARD" }] });
  clauses.push(...anyOf("languageName", filters.languages));

  const minDownloads = positiveNumber(filters.minDownloads);
  if (minDownloads) clauses.push({ downloads: [{ value: Math.round(minDownloads), op: "GTE" }] });
  const minEndorsements = positiveNumber(filters.minEndorsements);
  if (minEndorsements) {
    clauses.push({ endorsements: [{ value: Math.round(minEndorsements), op: "GTE" }] });
  }
  const minSize = positiveNumber(filters.minSizeMB);
  if (minSize) clauses.push({ fileSize: [{ value: Math.round(minSize * 1024), op: "GTE" }] });
  const maxSize = positiveNumber(filters.maxSizeMB);
  if (maxSize) clauses.push({ fileSize: [{ value: Math.round(maxSize * 1024), op: "LTE" }] });

  if (filters.updatedWithin) {
    const since = Math.floor(now / 1000) - SECONDS[filters.updatedWithin];
    clauses.push({ updatedAt: [{ value: String(since), op: "GTE" }] });
  }
  if (filters.onlyUpdated) clauses.push({ hasUpdated: [{ value: true, op: "EQUALS" }] });
  return clauses;
}

export function collectionClauses(filters: IBrowseFilters): Clause[] {
  const clauses = tagClauses(filters);
  clauses.push(...anyOf("gameVersion", filters.gameVersions));
  const minRating = positiveNumber(filters.minRating);
  if (minRating) clauses.push({ recentRating: [{ value: minRating, op: "GTE" }] });
  if (filters.withBadge) clauses.push({ badges: [{ op: "EXISTS" }] });
  return clauses;
}

/** le nombre de réglages actifs, pour le bouton « Afficher les filtres (N) » */
export function activeFilterCount(filters: IBrowseFilters): number {
  return (Object.keys(EMPTY_FILTERS) as Array<keyof IBrowseFilters>).reduce((count, key) => {
    const value = filters[key];
    if (Array.isArray(value)) return count + value.length;
    if (typeof value === "boolean") return count + (value ? 1 : 0);
    return count + (value.trim() !== "" ? 1 : 0);
  }, 0);
}
