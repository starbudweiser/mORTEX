/**
 * mORTEX (macOS) : choix de la version à proposer, depuis les releases GitHub de mORTEX.
 *
 * Fonctions pures, sans Electron : chargeables dans vitest.
 * Une release n'est proposée que si elle contient l'archive `mORTEX-<version>-mac-arm64.zip` ET
 * une empreinte SHA-256 de cette archive (champ `digest` de l'API GitHub, ou fichier
 * `mORTEX-<version>-mac-arm64.zip.sha256`) : sans empreinte, rien n'est téléchargé.
 */

import * as semver from "semver";

export type MacChannel = "stable" | "beta";

export interface IMacAsset {
  name: string;
  browser_download_url: string;
  /** « sha256:<hex> », fourni par GitHub pour les fichiers déposés récemment */
  digest?: string | null;
}

export interface IMacRelease {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  body?: string | null;
  body_html?: string | null;
  assets: IMacAsset[];
}

export interface IMacUpdate {
  version: string;
  zipUrl: string;
  /** empreinte SHA-256 en hexadécimal, ou adresse du fichier `.sha256` à lire */
  sha256: string | undefined;
  sha256Url: string | undefined;
  notesHtml: string | undefined;
}

const zipName = (version: string) => `mORTEX-${version}-mac-arm64.zip`;

/** la plus haute version éligible, strictement supérieure à `current`, ou undefined */
export function pickMacUpdate(
  releases: IMacRelease[],
  current: string,
  channel: MacChannel,
): IMacUpdate | undefined {
  let best: IMacUpdate | undefined;
  for (const release of releases) {
    if (release.draft) continue;
    const version = semver.valid(release.tag_name.replace(/^v/i, ""));
    if (version === null) continue;
    // un indicateur « préversion » qui ne correspond pas au suffixe de la version : publication douteuse
    if (release.prerelease !== (semver.prerelease(version) !== null)) continue;
    if (release.prerelease && channel === "stable") continue;
    if (!semver.gt(version, current)) continue;
    if (best !== undefined && !semver.gt(version, best.version)) continue;

    const zip = release.assets.find((asset) => asset.name === zipName(version));
    if (zip === undefined) continue;
    const sidecar = release.assets.find((asset) => asset.name === `${zipName(version)}.sha256`);
    const digest = /^sha256:([0-9a-f]{64})$/i.exec(zip.digest ?? "")?.[1]?.toLowerCase();
    if (digest === undefined && sidecar === undefined) continue;

    best = {
      version,
      zipUrl: zip.browser_download_url,
      sha256: digest,
      sha256Url: sidecar?.browser_download_url,
      notesHtml: release.body_html ?? release.body ?? undefined,
    };
  }
  return best;
}

/** extrait l'empreinte d'un fichier `.sha256` (format « <hex>  <nom> » ou « <hex> ») */
export function parseSha256File(text: string): string | undefined {
  return /^\s*([0-9a-f]{64})\b/i.exec(text)?.[1]?.toLowerCase();
}
