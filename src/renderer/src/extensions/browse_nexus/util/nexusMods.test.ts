import { describe, expect, it } from "vitest";

import { decodeEntities, downloadableFiles, searchFilter, searchSort } from "./nexusMods";

const base = {
  gameDomain: "skyrimspecialedition",
  sort: "endorsements" as const,
  showAdult: false,
  offset: 0,
  count: 20,
};

describe("Nexus mod search", () => {
  it("filters on the game, the search, the category and hides adult content", () => {
    expect(searchFilter({ ...base, search: " SkyUI ", category: "User Interface" })).toEqual({
      gameDomainName: [{ value: "skyrimspecialedition", op: "EQUALS" }],
      name: [{ value: "SkyUI", op: "WILDCARD" }],
      categoryName: [{ value: "User Interface", op: "EQUALS" }],
      adultContent: [{ value: false, op: "EQUALS" }],
    });
    expect(searchFilter({ ...base, showAdult: true })).toEqual({
      gameDomainName: [{ value: "skyrimspecialedition", op: "EQUALS" }],
    });
  });

  it("sorts by relevance only when something is searched", () => {
    expect(searchSort({ ...base, sort: "relevance" })).toEqual([
      { endorsements: { direction: "DESC" } },
    ]);
    expect(searchSort({ ...base, sort: "relevance", search: "hair" })).toEqual([
      { relevance: { direction: "DESC" } },
    ]);
    expect(searchSort({ ...base, sort: "updatedAt" })).toEqual([
      { updatedAt: { direction: "DESC" } },
    ]);
  });

  it("decodes the entities of summaries", () => {
    expect(decodeEntities("Rock &amp; Roll isn&#39;t &quot;dead&quot;")).toBe(
      `Rock & Roll isn't "dead"`,
    );
  });

  it("keeps downloadable files, main ones first, newest first", () => {
    const files = downloadableFiles([
      {
        fileId: 1,
        name: "Old",
        version: "1",
        category: "OLD_VERSION",
        size: 1,
        sizeInBytes: "1",
        date: 9,
      },
      {
        fileId: 2,
        name: "Patch",
        version: "2",
        category: "OPTIONAL",
        size: 2,
        sizeInBytes: null,
        date: 8,
      },
      {
        fileId: 3,
        name: "Main 1",
        version: "1",
        category: "MAIN",
        size: 3,
        sizeInBytes: "3000",
        date: 1,
      },
      {
        fileId: 4,
        name: "Main 2",
        version: "2",
        category: "MAIN",
        size: 4,
        sizeInBytes: "4000",
        date: 5,
      },
      {
        fileId: 5,
        name: "Gone",
        version: "1",
        category: "ARCHIVED",
        size: 5,
        sizeInBytes: "5",
        date: 9,
      },
    ]);
    expect(files.map((file) => file.fileId)).toEqual([4, 3, 2]);
    expect(files[2].size).toBe(2048);
  });
});
