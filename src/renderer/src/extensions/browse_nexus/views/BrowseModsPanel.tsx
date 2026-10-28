/**
 * mORTEX : onglet Mods du navigateur Nexus. Recherche par nom, tri, filtres de la colonne de gauche
 * (comme sur nexusmods.com), pages de 20 mods,
 * puis téléchargement et installation d'un fichier choisi (util/downloadMod).
 */
import React, { type RefObject, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { createSelector } from "reselect";

import { isPremium } from "@/extensions/nexus_integration/selectors";
import { guessFromFileName } from "@/extensions/nexus_integration/util/guessModID";
import type { IExtensionApi } from "@/types/IExtensionContext";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { CollectionTileSkeleton } from "@/ui/components/collection_tile/CollectionTile.skeleton";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Listing } from "@/ui/components/listing/Listing";
import { Pagination } from "@/ui/components/pagination/Pagination";
import { Picker } from "@/ui/components/picker/Picker";
import { Typography } from "@/ui/components/typography/Typography";
import { getCurrentLanguage } from "@/util/i18n";

import { activeFilterCount, EMPTY_FILTERS, type IBrowseFilters } from "../util/browseFilters";
import { downloadMod, filePageUrl } from "../util/downloadMod";
import {
  type IFacets,
  type INexusModSummary,
  type ModSortField,
  searchMods,
} from "../util/nexusMods";
import { FilterSidebar } from "./FilterSidebar";
import { ModTile, type ModTileStatus } from "./ModTile";

const PAGE_SIZE = 20;

const SORT_OPTIONS: Array<{ value: ModSortField; label: string }> = [
  { value: "endorsements", label: "Most endorsed" },
  { value: "downloads", label: "Most downloaded" },
  { value: "updatedAt", label: "Recently updated" },
  { value: "createdAt", label: "Recently added" },
  { value: "relevance", label: "Best match" },
];

interface IProps {
  api: IExtensionApi;
  gameId: string;
  gameDomain: string;
  isLoggedIn: boolean;
  scrollRef: RefObject<HTMLDivElement>;
  t: (text: string, options?: Record<string, unknown>) => string;
}

/** les identifiants Nexus des mods installés et de ceux seulement téléchargés, pour le jeu */
const nexusModIds = createSelector(
  (state: IState, gameId: string) => state.persistent.mods?.[gameId],
  (state: IState) => state.persistent.downloads?.files,
  (_state: IState, gameId: string) => gameId,
  (mods, downloads, gameId) => {
    const installed = new Set<number>();
    for (const mod of Object.values(mods ?? {})) {
      const modId = Number(mod.attributes?.modId);
      if (mod.attributes?.source === "nexus" && modId > 0) installed.add(modId);
    }
    const downloaded = new Set<number>();
    for (const download of Object.values(downloads ?? {})) {
      // une archive importée d'un dossier n'a que son nom : « Nom-<modId>-<version>-<date>.7z »
      const modId = Number(
        download.modInfo?.nexus?.ids?.modId ??
          (download.localPath ? guessFromFileName(download.localPath) : undefined),
      );
      if (modId > 0 && download.game?.includes(gameId)) downloaded.add(modId);
    }
    return { installed, downloaded };
  },
);

export function BrowseModsPanel({ api, gameId, gameDomain, isLoggedIn, scrollRef, t }: IProps) {
  const premium = useSelector(isPremium);
  const showAdult = useSelector(
    (state: IState) => state.persistent["nexus"]?.userInfo?.adult === true,
  );
  const ids = useSelector((state: IState) => nexusModIds(state, gameId));

  const [mods, setMods] = useState<INexusModSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ModSortField>("endorsements");
  const [filters, setFilters] = useState<IBrowseFilters>(EMPTY_FILTERS);
  const [facets, setFacets] = useState<IFacets>({});
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [queryError, setQueryError] = useState("");

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    searchMods({
      gameDomain,
      search,
      filters,
      sort,
      showAdult,
      offset: (page - 1) * PAGE_SIZE,
      count: PAGE_SIZE,
    })
      .then((result) => {
        if (!current) return;
        setMods(result.nodes);
        setTotalCount(result.totalCount);
        setFacets(result.facets);
      })
      .catch((err: Error) => {
        if (current) setError(err);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [gameDomain, search, filters, sort, showAdult, page, refresh]);

  const sortOptions = useMemo(
    () => SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) })),
    [t],
  );
  const filterCount = activeFilterCount(filters);

  const submitSearch = () => {
    // Nexus refuse une recherche d'un seul caractère
    if (query.trim().length === 1) {
      setQueryError(t("Type at least 2 characters"));
      return;
    }
    setQueryError("");
    setSearch(query.trim());
    if (query.trim() !== "" && sort === "endorsements") setSort("relevance");
    setPage(1);
  };

  const statusOf = (mod: INexusModSummary): ModTileStatus =>
    ids.installed.has(mod.modId)
      ? "installed"
      : ids.downloaded.has(mod.modId)
        ? "downloaded"
        : undefined;

  return (
    <div className="space-y-3 p-6">
      <form
        className="flex items-start gap-x-2"
        onSubmit={(evt) => {
          evt.preventDefault();
          submitSearch();
        }}
      >
        <TextField
          errorMessage={queryError || undefined}
          fieldClassName="max-w-80"
          hideLabel={true}
          label={t("Search mods...")}
          placeholder={t("Search mods...")}
          value={query}
          onChange={(evt) => {
            setQuery(evt.target.value);
            if (queryError) setQueryError("");
          }}
        />

        <Button
          appearance="moderate"
          brand="neutral"
          leftIcon="search"
          title={t("Search")}
          type="submit"
        />
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-x-2">
          <Button
            appearance="moderate"
            brand="neutral"
            leftIcon="filter_list"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters
              ? t("Hide filters")
              : filterCount > 0
                ? t("Show filters ({{count}})", { replace: { count: filterCount } })
                : t("Show filters")}
          </Button>

          <Button
            appearance="moderate"
            brand="neutral"
            leftIcon="refresh"
            title={t("Refresh")}
            onClick={() => setRefresh((value) => value + 1)}
          />

          <Typography appearance="moderate" brand="neutral-translucent" typographyType="body-sm">
            {t("{{total}} mod", {
              count: totalCount,
              replace: { total: totalCount.toLocaleString(getCurrentLanguage()) },
            })}
          </Typography>
        </div>

        <div className="flex items-center gap-x-2">
          <Picker
            options={sortOptions}
            value={sort}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="flex items-start gap-x-6">
        {showFilters && (
          <FilterSidebar
            facets={facets}
            filters={filters}
            kind="mods"
            t={t}
            onChange={(value) => {
              setFilters(value);
              setPage(1);
            }}
          />
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <Listing
            className="grid grid-cols-[repeat(auto-fit,minmax(26rem,1fr))] gap-4"
            entityCount={mods.length}
            errorMessage={error?.message}
            errorTitle={t("Couldn't reach Nexus Mods")}
            isError={!!error}
            isLoading={loading}
            noResultsMessage={t("Try another search or fewer filters.")}
            noResultsTitle={t("No mods found")}
            skeletonCount={12}
            SkeletonTile={CollectionTileSkeleton}
          >
            {mods.map((mod) => (
              <ModTile
                isLoggedIn={isLoggedIn}
                key={mod.modId}
                mod={mod}
                status={statusOf(mod)}
                t={t}
                onDownload={() => downloadMod(api, mod, premium)}
                onViewPage={() =>
                  window.api.shell.openUrl(filePageUrl(mod).replace("?tab=files", ""))
                }
              />
            ))}
          </Listing>

          <Pagination
            currentPage={page}
            recordsPerPage={PAGE_SIZE}
            scrollRef={scrollRef}
            totalRecords={totalCount}
            onPaginationUpdate={setPage}
          />
        </div>
      </div>
    </div>
  );
}
