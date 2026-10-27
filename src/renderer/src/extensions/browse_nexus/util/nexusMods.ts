/**
 * mORTEX : recherche de mods et de leurs fichiers sur Nexus Mods, par l'API GraphQL v2 publique
 * (la bibliothèque @nexusmods/nexus-api ne sait chercher que des collections).
 *
 * Interface :
 *  - searchMods(options): Promise<IModSearchResult>    une page de mods d'un jeu
 *  - modFiles(modId, gameNumId): Promise<INexusModFile[]>  les fichiers téléchargeables d'un mod,
 *    principaux d'abord, puis du plus récent au plus ancien
 */

const ENDPOINT = "https://api.nexusmods.com/v2/graphql";

export type ModSortField = "relevance" | "endorsements" | "downloads" | "updatedAt" | "createdAt";

export interface INexusModSummary {
  modId: number;
  name: string;
  summary: string;
  version: string;
  author: string;
  uploader: string;
  thumbnailUrl?: string;
  endorsements: number;
  downloads: number;
  /** en octets */
  fileSize: number;
  adultContent: boolean;
  updatedAt: string;
  category?: string;
  gameDomain: string;
  gameNumId: number;
}

export interface IModSearchOptions {
  gameDomain: string;
  search?: string;
  category?: string;
  sort: ModSortField;
  showAdult: boolean;
  offset: number;
  count: number;
}

export interface IModSearchResult {
  totalCount: number;
  nodes: INexusModSummary[];
}

export type ModFileCategory = "MAIN" | "OPTIONAL" | "UPDATE" | "MISCELLANEOUS";

export interface INexusModFile {
  fileId: number;
  name: string;
  version: string;
  category: ModFileCategory;
  /** en octets */
  size: number;
  /** en secondes depuis 1970 */
  date: number;
}

const FILE_CATEGORIES: ModFileCategory[] = ["MAIN", "OPTIONAL", "UPDATE", "MISCELLANEOUS"];

async function query<T>(text: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: text, variables }),
  });
  if (!response.ok) {
    throw new Error(`Nexus Mods answered ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (body.errors?.length) {
    throw new Error(body.errors.map((err) => err.message).join("; "));
  }
  return body.data as T;
}

const decoder = typeof document !== "undefined" ? document.createElement("textarea") : undefined;

/** les résumés arrivent avec des entités HTML (&#39;, &amp;…) */
export function decodeEntities(text: string): string {
  if (decoder === undefined || !text.includes("&")) return text;
  decoder.innerHTML = text;
  return decoder.value;
}

const SEARCH_QUERY = `query mortexMods($filter: ModsFilter, $sort: [ModsSort!], $offset: Int, $count: Int) {
  mods(filter: $filter, sort: $sort, offset: $offset, count: $count) {
    totalCount
    nodes {
      modId name summary version author uploader { name } thumbnailUrl
      endorsements downloads fileSize adultContent updatedAt
      modCategory { name } game { id domainName }
    }
  }
}`;

interface IRawMod {
  modId: number;
  name: string;
  summary: string | null;
  version: string | null;
  author: string | null;
  uploader: { name: string } | null;
  thumbnailUrl: string | null;
  endorsements: number;
  downloads: number;
  fileSize: number | null;
  adultContent: boolean;
  updatedAt: string;
  modCategory: { name: string } | null;
  game: { id: number; domainName: string };
}

export function searchFilter(options: IModSearchOptions): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    gameDomainName: [{ value: options.gameDomain, op: "EQUALS" }],
  };
  const search = options.search?.trim();
  if (search) filter.name = [{ value: search, op: "WILDCARD" }];
  if (options.category) filter.categoryName = [{ value: options.category, op: "EQUALS" }];
  if (!options.showAdult) filter.adultContent = [{ value: false, op: "EQUALS" }];
  return filter;
}

export function searchSort(options: IModSearchOptions): Array<Record<string, unknown>> {
  // la pertinence n'a de sens qu'avec un texte cherché
  const field =
    options.sort === "relevance" && !options.search?.trim() ? "endorsements" : options.sort;
  return [{ [field]: { direction: "DESC" } }];
}

export async function searchMods(options: IModSearchOptions): Promise<IModSearchResult> {
  const data = await query<{ mods: { totalCount: number; nodes: IRawMod[] } }>(SEARCH_QUERY, {
    filter: searchFilter(options),
    sort: searchSort(options),
    offset: options.offset,
    count: options.count,
  });
  return {
    totalCount: data.mods.totalCount,
    nodes: data.mods.nodes.map((mod) => ({
      modId: mod.modId,
      name: decodeEntities(mod.name),
      summary: decodeEntities(mod.summary ?? ""),
      version: mod.version ?? "",
      author: decodeEntities(mod.author ?? mod.uploader?.name ?? ""),
      uploader: mod.uploader?.name ?? "",
      thumbnailUrl: mod.thumbnailUrl ?? undefined,
      endorsements: mod.endorsements,
      downloads: mod.downloads,
      fileSize: (mod.fileSize ?? 0) * 1024,
      adultContent: mod.adultContent,
      updatedAt: mod.updatedAt,
      category: mod.modCategory?.name,
      gameDomain: mod.game.domainName,
      gameNumId: mod.game.id,
    })),
  };
}

const FILES_QUERY = `query mortexModFiles($modId: ID!, $gameId: ID!) {
  modFiles(modId: $modId, gameId: $gameId) {
    fileId name version category size sizeInBytes date
  }
}`;

interface IRawFile {
  fileId: number;
  name: string;
  version: string | null;
  category: string;
  size: number;
  sizeInBytes: string | null;
  date: number;
}

/** garde les fichiers téléchargeables, principaux d'abord, puis du plus récent au plus ancien */
export function downloadableFiles(files: IRawFile[]): INexusModFile[] {
  return files
    .filter((file) => FILE_CATEGORIES.includes(file.category as ModFileCategory))
    .map((file) => ({
      fileId: file.fileId,
      name: decodeEntities(file.name),
      version: file.version ?? "",
      category: file.category as ModFileCategory,
      size: file.sizeInBytes !== null ? Number(file.sizeInBytes) : file.size * 1024,
      date: file.date,
    }))
    .sort(
      (lhs, rhs) =>
        FILE_CATEGORIES.indexOf(lhs.category) - FILE_CATEGORIES.indexOf(rhs.category) ||
        rhs.date - lhs.date,
    );
}

export async function modFiles(modId: number, gameNumId: number): Promise<INexusModFile[]> {
  const data = await query<{ modFiles: IRawFile[] }>(FILES_QUERY, {
    modId: String(modId),
    gameId: String(gameNumId),
  });
  return downloadableFiles(data.modFiles ?? []);
}
