/**
 * mORTEX : recherche de collections sur Nexus Mods avec les filtres de la colonne de gauche et
 * leurs compteurs (la recherche de @nexusmods/nexus-api ne sait filtrer que par catégorie).
 *
 * Interface :
 *  - searchCollections(options): Promise<ICollectionSearchPage>  une page de collections, au format
 *    ICollection attendu par CollectionTile, et les compteurs (catégories, tags, versions du jeu)
 */
import type { CollectionSortField, ICollection, SortDirection } from "@nexusmods/nexus-api";

import {
  categoryClause,
  collectionClauses,
  EMPTY_FILTERS,
  type IBrowseFilters,
} from "./browseFilters";
import { type IFacets, nexusGraphQuery } from "./nexusMods";

export interface ICollectionSearchOptions {
  gameDomain: string;
  search?: string;
  sort: { field: CollectionSortField; direction: SortDirection };
  showAdult: boolean;
  filters?: IBrowseFilters;
  offset: number;
  count: number;
}

export interface ICollectionSearchPage {
  totalCount: number;
  nodes: ICollection[];
  facets: IFacets;
}

const SEARCH_QUERY = `query mortexCollections($filter: CollectionsSearchFilter, $categoryFilter: CollectionsSearchFilter, $sort: [CollectionsSearchSort!], $offset: Int, $count: Int) {
  collectionsV2(filter: $filter, sort: $sort, offset: $offset, count: $count, facets: { tag: [], gameVersion: [] }) {
    totalCount
    facetsData
    nodes {
      id name slug collectionStatus endorsements totalDownloads summary recentRating
      badges { name description }
      permissions { global key }
      category { name }
      game { domainName id name }
      latestPublishedRevision { id revisionNumber adultContent modCount totalSize }
      tileImage { url thumbnailUrl(size: med) }
      user { avatar memberId name }
    }
  }
  categories: collectionsV2(filter: $categoryFilter, count: 0, facets: { categoryName: [] }) {
    facetsData
  }
}`;

/** le filtre complet ; `withCategories: false` pour les compteurs de catégories */
export function collectionFilter(
  options: ICollectionSearchOptions,
  withCategories = true,
): Record<string, unknown> {
  const filters = options.filters ?? EMPTY_FILTERS;
  const filter: Record<string, unknown> = {
    gameDomain: [{ value: options.gameDomain, op: "EQUALS" }],
    collectionStatus: [{ value: "listed", op: "EQUALS" }],
    // les listes Wabbajack ne s'installent pas avec mORTEX
    categoryName: [{ value: "Wabbajack Mod List", op: "NOT_EQUALS" }],
  };
  const search = options.search?.trim();
  if (search) filter.generalSearch = [{ value: search, op: "WILDCARD" }];
  if (!options.showAdult) filter.adultContent = [{ value: false, op: "EQUALS" }];
  const clauses = [
    ...collectionClauses(filters),
    ...(withCategories ? categoryClause("categoryName", filters.categories) : []),
  ];
  if (clauses.length > 0) filter.filter = clauses;
  return filter;
}

export async function searchCollections(
  options: ICollectionSearchOptions,
): Promise<ICollectionSearchPage> {
  const data = await nexusGraphQuery<{
    collectionsV2: { totalCount: number; facetsData: IFacets | null; nodes: ICollection[] };
    categories: { facetsData: IFacets | null };
  }>(SEARCH_QUERY, {
    filter: collectionFilter(options),
    categoryFilter: collectionFilter(options, false),
    sort: [{ [options.sort.field]: { direction: options.sort.direction } }],
    offset: options.offset,
    count: options.count,
  });
  const facets: IFacets = { ...data.collectionsV2.facetsData, ...data.categories.facetsData };
  delete facets.categoryName?.["Wabbajack Mod List"];
  return { totalCount: data.collectionsV2.totalCount, nodes: data.collectionsV2.nodes, facets };
}
