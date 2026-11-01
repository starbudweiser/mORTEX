import { describe, expect, it } from "vitest";

import type { IMacRelease } from "./macReleases";
import { parseSha256File, pickMacUpdate } from "./macReleases";

const HASH = "a".repeat(64);

const release = (tag: string, extra: Partial<IMacRelease> = {}): IMacRelease => {
  const version = tag.replace(/^v/, "");
  return {
    tag_name: tag,
    draft: false,
    prerelease: version.includes("-"),
    assets: [
      {
        name: `mORTEX-${version}-mac-arm64.zip`,
        browser_download_url: `https://example.test/${version}.zip`,
        digest: `sha256:${HASH}`,
      },
    ],
    ...extra,
  };
};

describe("pickMacUpdate", () => {
  it("propose la plus haute version supérieure à l'actuelle", () => {
    const found = pickMacUpdate(
      [release("v1.0.1"), release("v1.2.0"), release("v1.1.0")],
      "1.0.0",
      "stable",
    );
    expect(found?.version).toBe("1.2.0");
    expect(found?.sha256).toBe(HASH);
  });

  it("ne propose rien si on est à jour", () => {
    expect(pickMacUpdate([release("v1.0.0")], "1.0.0", "stable")).toBeUndefined();
    expect(pickMacUpdate([release("v0.9.0")], "1.0.0", "stable")).toBeUndefined();
  });

  it("ignore les brouillons et, en stable, les préversions", () => {
    expect(pickMacUpdate([release("v1.1.0", { draft: true })], "1.0.0", "stable")).toBeUndefined();
    expect(pickMacUpdate([release("v1.1.0-beta.1")], "1.0.0", "stable")).toBeUndefined();
    expect(pickMacUpdate([release("v1.1.0-beta.1")], "1.0.0", "beta")?.version).toBe(
      "1.1.0-beta.1",
    );
  });

  it("refuse une release sans archive ou sans empreinte", () => {
    expect(pickMacUpdate([release("v1.1.0", { assets: [] })], "1.0.0", "stable")).toBeUndefined();
    const noHash = release("v1.1.0");
    noHash.assets[0]!.digest = null;
    expect(pickMacUpdate([noHash], "1.0.0", "stable")).toBeUndefined();
  });

  it("accepte l'empreinte d'un fichier .sha256 à côté de l'archive", () => {
    const withSidecar = release("v1.1.0");
    withSidecar.assets[0]!.digest = null;
    withSidecar.assets.push({
      name: "mORTEX-1.1.0-mac-arm64.zip.sha256",
      browser_download_url: "https://example.test/1.1.0.zip.sha256",
    });
    const found = pickMacUpdate([withSidecar], "1.0.0", "stable");
    expect(found?.sha256).toBeUndefined();
    expect(found?.sha256Url).toBe("https://example.test/1.1.0.zip.sha256");
  });
});

describe("parseSha256File", () => {
  it("lit l'empreinte avec ou sans nom de fichier", () => {
    expect(parseSha256File(`${HASH}  mORTEX-1.1.0-mac-arm64.zip\n`)).toBe(HASH);
    expect(parseSha256File(HASH.toUpperCase())).toBe(HASH);
    expect(parseSha256File("rien")).toBeUndefined();
  });
});
