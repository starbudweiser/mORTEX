import { describe, it, expect } from "vitest";

import { type IModWithState } from "../views/CheckModVersionsButton";
import group from "./modGrouping";

describe("modGrouping", () => {
  it("can group by mod id", () => {
    const input = [
      { id: "a", attributes: { modId: 42 } },
      { id: "b", attributes: { modId: 43 } },
      { id: "c", attributes: { modId: 42 } },
    ];
    const result = group(input as IModWithState[], {
      groupBy: "modId",
      multipleEnabled: true,
    });
    expect(result).toEqual([
      [
        { id: "a", attributes: { modId: 42 } },
        { id: "c", attributes: { modId: 42 } },
      ],
      [{ id: "b", attributes: { modId: 43 } }],
    ]);
  });
  it("can avoid multiple enabled", () => {
    const input = [
      { id: "a", enabled: true, attributes: { modId: 42, version: "1.1.0" } },
      { id: "b", enabled: true, attributes: { modId: 43, version: "1.0.0" } },
      { id: "c", enabled: false, attributes: { modId: 42, version: "1.0.0" } },
      { id: "d", enabled: true, attributes: { modId: 42, version: "1.0.0" } },
    ];
    const result = group(input as IModWithState[], {
      groupBy: "modId",
      multipleEnabled: false,
    });
    expect(result).toEqual([
      [
        { id: "a", enabled: true, attributes: { modId: 42, version: "1.1.0" } },
        {
          id: "c",
          enabled: false,
          attributes: { modId: 42, version: "1.0.0" },
        },
      ],
      [{ id: "d", enabled: true, attributes: { modId: 42, version: "1.0.0" } }],
      [{ id: "b", enabled: true, attributes: { modId: 43, version: "1.0.0" } }],
    ]);
  });
  it("can group by logical file name", () => {
    const input = [
      { id: "a", attributes: { modId: 42, logicalFileName: "42" } },
      { id: "b", attributes: { modId: 43, logicalFileName: "43" } },
      { id: "c", attributes: { modId: 42, logicalFileName: "42" } },
      { id: "d", attributes: { modId: 42, logicalFileName: "42_2" } },
    ];
    const result = group(input as IModWithState[], {
      groupBy: "file",
      multipleEnabled: true,
    });
    expect(result).toEqual([
      [
        { id: "a", attributes: { modId: 42, logicalFileName: "42" } },
        { id: "c", attributes: { modId: 42, logicalFileName: "42" } },
      ],
      [{ id: "d", attributes: { modId: 42, logicalFileName: "42_2" } }],
      [{ id: "b", attributes: { modId: 43, logicalFileName: "43" } }],
    ]);
  });
  it("can group by file id", () => {
    const input = [
      { id: "a", attributes: { modId: 42 } },
      { id: "b", attributes: { modId: 43 } },
      { id: "c", attributes: { modId: 42 } },
      { id: "d", attributes: { modId: 42 } },
    ];
    const result = group(input as IModWithState[], {
      groupBy: "file",
      multipleEnabled: true,
    });
    expect(result).toEqual([
      [{ id: "a", attributes: { modId: 42 } }],
      [{ id: "c", attributes: { modId: 42 } }],
      [{ id: "d", attributes: { modId: 42 } }],
      [{ id: "b", attributes: { modId: 43 } }],
    ]);
  });

  it("groups by file with newest file id or logical name, ignoring collections", () => {
    const input = [
      {
        id: "a",
        attributes: { modId: 1, newestFileId: 10, logicalFileName: "Foo 1.0", version: "1.0" },
      },
      {
        id: "b",
        attributes: { modId: 1, newestFileId: 10, logicalFileName: "Foo 2.0", version: "2.0" },
      },
      { id: "c", attributes: { modId: 1, logicalFileName: "Bar 1.0", version: "1.0" } },
      { id: "d", attributes: { modId: 1, logicalFileName: "Bar 2.0", version: "2.0" } },
      { id: "e", attributes: { modId: 1, collectionSlug: "x", newestFileId: 10 } },
    ];
    const result = group(input as unknown as IModWithState[], {
      groupBy: "file",
      multipleEnabled: true,
    });
    expect(result.map((g) => g.map((m) => m.id).sort())).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  it("groups 5000 mods quickly", () => {
    const input = Array.from({ length: 5000 }, (_, i) => ({
      id: `m${i}`,
      attributes: { modId: i % 50, logicalFileName: `File ${i}`, version: "1" },
    }));
    const start = performance.now();
    group(input as unknown as IModWithState[], { groupBy: "file", multipleEnabled: true });
    expect(performance.now() - start).toBeLessThan(1000);
  });
});
