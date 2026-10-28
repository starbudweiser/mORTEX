import { describe, expect, it } from "vitest";

import {
  activeFilterCount,
  categoryClause,
  collectionClauses,
  EMPTY_FILTERS,
  modClauses,
} from "./browseFilters";
import { collectionFilter } from "./nexusCollections";
import { searchFilter } from "./nexusMods";

const NOW = 1_800_000_000_000;

describe("browse filters", () => {
  it("asks for nothing when no filter is set", () => {
    expect(modClauses(EMPTY_FILTERS, NOW)).toEqual([]);
    expect(collectionClauses(EMPTY_FILTERS)).toEqual([]);
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it("requires every included tag and hides every excluded one", () => {
    const clauses = modClauses(
      {
        ...EMPTY_FILTERS,
        tagsInclude: ["Textures", "Lore-Friendly"],
        tagsExclude: ["Translation"],
      },
      NOW,
    );

    expect(clauses).toEqual([
      {
        tag: [
          { value: "Textures", op: "EQUALS" },
          { value: "Lore-Friendly", op: "EQUALS" },
        ],
      },
      { tag: [{ value: "Translation", op: "NOT_EQUALS" }] },
    ]);
  });

  it("matches any of the ticked categories, as a nested OR", () => {
    expect(categoryClause("categoryName", ["Armour", "Audio"])).toEqual([
      {
        op: "OR",
        categoryName: [
          { value: "Armour", op: "EQUALS" },
          { value: "Audio", op: "EQUALS" },
        ],
      },
    ]);
  });

  it("turns sizes in MB into KiB, dates into seconds and ignores one-letter texts", () => {
    const clauses = modClauses(
      {
        ...EMPTY_FILTERS,
        author: "a",
        uploader: " Arthmoor ",
        minSizeMB: "1,5",
        maxSizeMB: "abc",
        updatedWithin: "week",
      },
      NOW,
    );

    expect(clauses).toEqual([
      { uploader: [{ value: "Arthmoor", op: "WILDCARD" }] },
      { fileSize: [{ value: 1536, op: "GTE" }] },
      { updatedAt: [{ value: String(1_800_000_000 - 7 * 86_400), op: "GTE" }] },
    ]);
  });

  it("filters collections by game version, rating and badge", () => {
    expect(
      collectionClauses({
        ...EMPTY_FILTERS,
        gameVersions: ["1.6.1170.0"],
        minRating: "70",
        withBadge: true,
      }),
    ).toEqual([
      { op: "OR", gameVersion: [{ value: "1.6.1170.0", op: "EQUALS" }] },
      { recentRating: [{ value: 70, op: "GTE" }] },
      { badges: [{ op: "EXISTS" }] },
    ]);
  });

  it("counts each ticked value and each filled field", () => {
    expect(
      activeFilterCount({
        ...EMPTY_FILTERS,
        categories: ["Armour", "Audio"],
        author: "x",
        onlyUpdated: true,
      }),
    ).toBe(4);
  });

  it("leaves the ticked categories out of the query that counts categories", () => {
    const options = {
      gameDomain: "skyrimspecialedition",
      sort: "endorsements" as const,
      showAdult: true,
      offset: 0,
      count: 20,
      filters: { ...EMPTY_FILTERS, categories: ["Armour"], tagsInclude: ["Textures"] },
    };

    expect(searchFilter(options, true, NOW).filter).toHaveLength(2);
    expect(searchFilter(options, false, NOW).filter).toEqual([
      { tag: [{ value: "Textures", op: "EQUALS" }] },
    ]);
  });

  it("keeps Wabbajack lists and unlisted collections out", () => {
    const filter = collectionFilter({
      gameDomain: "skyrimspecialedition",
      sort: { field: "endorsements", direction: "DESC" },
      showAdult: false,
      offset: 0,
      count: 20,
    });

    expect(filter).toEqual({
      gameDomain: [{ value: "skyrimspecialedition", op: "EQUALS" }],
      collectionStatus: [{ value: "listed", op: "EQUALS" }],
      categoryName: [{ value: "Wabbajack Mod List", op: "NOT_EQUALS" }],
      adultContent: [{ value: false, op: "EQUALS" }],
    });
  });
});
