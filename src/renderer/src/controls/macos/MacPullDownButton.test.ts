import { describe, expect, it, vi } from "vitest";

import { buildMenu, canPullDown } from "./MacPullDownButton";

const t = ((text: string) => `«${text}»`) as any;

describe("MacPullDownButton menu", () => {
  it("turns the other actions into a native menu, with their ids", () => {
    const unpack = vi.fn();
    const { items, byId } = buildMenu(
      t,
      [
        { title: "Unpack (as-is)", icon: "start-install", show: true, action: unpack },
        { title: "Remove", icon: "delete", show: "Still downloading" },
        { title: "Advanced", icon: null, show: true },
        { title: "Open", icon: "open", show: true, subMenus: [{ title: "In Finder" }] },
      ] as any,
      ["dl1"],
    );

    expect(items).toEqual([
      { id: "0", label: "«Unpack (as-is)»", enabled: true, toolTip: undefined },
      { id: "1", label: "«Remove»", enabled: false, toolTip: "Still downloading" },
      { type: "separator" },
      { label: "«Advanced»", enabled: false },
      {
        label: "«Open»",
        enabled: true,
        submenu: [{ id: "3.0", label: "«In Finder»", enabled: true, toolTip: undefined }],
      },
    ]);
    byId.get("0")?.action?.(["dl1"]);
    expect(unpack).toHaveBeenCalledWith(["dl1"]);
    expect(byId.get("3.0")?.title).toBe("In Finder");
  });

  it("leaves actions with their own component to the HTML menu", () => {
    expect(canPullDown([{ title: "A", show: true }] as any)).toBe(true);
    expect(canPullDown([{ title: "A", show: true, component: () => null }] as any)).toBe(false);
  });
});
