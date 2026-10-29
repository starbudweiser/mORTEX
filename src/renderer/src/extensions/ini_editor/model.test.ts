import { describe, expect, it } from "vitest";

import { type IIniFile, readEffective, settingId } from "../../util/macos/iniEdit";
import { SKYRIMSE_CATALOG } from "./catalog/skyrimse";
import {
  type IValueContext,
  baseValue,
  formatNumber,
  currentValue,
  isEnabled,
  isValid,
  normalizeNumber,
  pendingChanges,
  pendingFromPreset,
  targetRole,
  withValue,
  writtenLine,
} from "./model";

const setting = (id: string) => {
  const found = SKYRIMSE_CATALOG.find((s) => s.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

const file = (role: IIniFile["role"], text: string): IIniFile => ({
  role,
  path: `/x/${role}.ini`,
  text,
});

const context = (files: IIniFile[], defaults: Record<string, string> = {}): IValueContext => ({
  effective: readEffective(files),
  defaults: new Map(
    Object.entries(defaults).map(([id, value]) => {
      const [section, key] = id.split(":");
      return [settingId(section, key), value];
    }),
  ),
  pending: {},
});

describe("modèle de l'Éditeur de réglages", () => {
  const ctx = context(
    [
      file("prefs", "[Display]\niShadowMapResolution=2048\nfGamma=1.0000\nbUseTAA=1\n"),
      file("ini", "[LOD]\nfLODFadeOutMultObjects=15.0000\n"),
    ],
    { "Display:fShadowDistance": "8000.0000" },
  );

  it("shows the file value, else Bethesda's default, else nothing", () => {
    expect(baseValue(ctx, setting("shadowResolution"))).toBe("2048");
    expect(baseValue(ctx, setting("shadowDistance"))).toBe("8000.0000");
    expect(baseValue(ctx, setting("interiorShadowDistance"))).toBeUndefined();
  });

  it("records a change only when it differs, comparing numbers as numbers", () => {
    const shadows = setting("shadowResolution");
    const changed = withValue(ctx, shadows, "4096");
    expect(changed).toEqual({ shadowResolution: "4096" });
    expect(currentValue({ ...ctx, pending: changed }, shadows)).toBe("4096");

    // revenir à la valeur d'origine annule le changement
    expect(withValue({ ...ctx, pending: changed }, shadows, "2048")).toEqual({});
    expect(withValue(ctx, setting("gamma"), "1")).toEqual({});
    expect(withValue(ctx, setting("objectFade"), "15")).toEqual({});
    expect(withValue(ctx, setting("shadowDistance"), "8000")).toEqual({});
  });

  it("lists the changes in iniEdit's format, in catalog order", () => {
    let pending = withValue(ctx, setting("gamma"), "1.2");
    pending = withValue({ ...ctx, pending }, setting("shadowResolution"), "4096");
    expect(pendingChanges(SKYRIMSE_CATALOG, pending)).toEqual([
      { section: "Display", key: "fGamma", value: "1.2" },
      { section: "Display", key: "iShadowMapResolution", value: "4096" },
    ]);
  });

  it("greys a setting out until the one it depends on is on", () => {
    const sharpen = setting("taaSharpen");
    expect(isEnabled(ctx, sharpen, SKYRIMSE_CATALOG)).toBe(true);
    const off = withValue(ctx, setting("taa"), "0");
    expect(isEnabled({ ...ctx, pending: off }, sharpen, SKYRIMSE_CATALOG)).toBe(false);
  });

  it("handles dependencies on a value other than 0 (multisampling)", () => {
    const transparency = setting("transparencyMultisample");
    expect(isEnabled(ctx, transparency, SKYRIMSE_CATALOG)).toBe(false);
    const on = withValue(ctx, setting("multisample"), "4");
    expect(isEnabled({ ...ctx, pending: on }, transparency, SKYRIMSE_CATALOG)).toBe(true);
  });

  it("writes where iniEdit will: the file with the value, else Prefs for graphics, else Skyrim.ini", () => {
    expect(targetRole(setting("shadowResolution"), ctx)).toBe("prefs");
    expect(targetRole(setting("objectFade"), ctx)).toBe("ini");
    expect(targetRole(setting("anisotropy"), ctx)).toBe("prefs");
    expect(targetRole(setting("language"), ctx)).toBe("ini");
    expect(writtenLine(setting("shadowResolution"), "4096", ctx)).toBe(
      "[Display] iShadowMapResolution=4096 → SkyrimPrefs.ini",
    );
  });

  it("validates numbers against the catalog's bounds", () => {
    expect(isValid(setting("gamma"), "1.2")).toBe(true);
    expect(isValid(setting("gamma"), "9")).toBe(false);
    expect(isValid(setting("gamma"), "")).toBe(false);
    expect(isValid(setting("gamma"), "abc")).toBe(false);
    expect(isValid(setting("focusShadows"), "2.5")).toBe(false);
    expect(isValid(setting("taa"), "1")).toBe(true);
    expect(isValid(setting("taa"), "2")).toBe(false);
  });

  it("applies a Bethesda preset to the settings the catalog knows", () => {
    const pending = pendingFromPreset(
      SKYRIMSE_CATALOG,
      [
        { section: "Display", key: "iShadowMapResolution", value: "4096" },
        { section: "Display", key: "fGamma", value: "1.0" },
        { section: "LOD", key: "fLODFadeOutMultObjects", value: "30" },
        { section: "Nowhere", key: "bUnknown", value: "1" },
      ],
      ctx,
    );
    expect(pending).toEqual({ shadowResolution: "4096", objectFade: "30" });
  });
});

describe("nombres affichés", () => {
  it("drops useless zeros and accepts a comma", () => {
    expect(formatNumber("10000.0000")).toBe("10000");
    expect(formatNumber("0.0125")).toBe("0.0125");
    expect(formatNumber("9999999.0000")).toBe("9999999");
    expect(formatNumber("STRINGS")).toBe("STRINGS");
    expect(formatNumber(undefined)).toBe("");
    expect(normalizeNumber(" 1,5 ")).toBe("1.5");
  });
});
