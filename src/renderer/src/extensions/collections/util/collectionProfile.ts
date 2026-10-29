/**
 * mORTEX : le profil qu'une collection a créé pour s'installer, et sa suppression au retrait de la
 * collection (proposée par une case de la boîte de retrait, annulable).
 *
 * Interface :
 *  - collectionProfile(state, gameId, collection)  le profil créé pour cette collection, s'il n'est
 *    pas le seul du jeu : marqué createdForCollection, ou, pour ceux créés avant ce marquage, du
 *    même nom que la collection
 *  - fallbackProfile(state, gameId, excludeId)     le profil sur lequel revenir (le plus récent)
 *  - removeCollectionProfile(api, profile, fallback)  revient sur `fallback` si besoin, met le
 *    dossier du profil de côté, supprime le profil et propose « Annuler » dans une notification
 */
import { cp, mkdir, rm } from "node:fs/promises";
import * as path from "node:path";

import type { IExtensionApi } from "../../../types/IExtensionContext";
import type { IState } from "../../../types/IState";
import getVortexPath from "../../../util/getVortexPath";
import { log } from "../../../util/log";
import type { IMod } from "../../mod_management/types/IMod";
import renderModName from "../../mod_management/util/modName";
import { setProfile } from "../../profile_management/actions/profiles";
import { setNextProfile } from "../../profile_management/actions/settings";
import type { IProfile } from "../../profile_management/types/IProfile";
import { profilePath, removeProfile } from "../../profile_management/util/manage";

const gameProfiles = (state: IState, gameId: string): IProfile[] =>
  Object.values(state.persistent.profiles ?? {}).filter(
    (profile) => profile.gameId === gameId && profile.pendingRemove !== true,
  );

export function collectionProfile(
  state: IState,
  gameId: string,
  collection: IMod,
): IProfile | undefined {
  const profiles = gameProfiles(state, gameId);
  if (profiles.length < 2) return undefined;
  return (
    profiles.find((profile) => profile.createdForCollection === collection.id) ??
    profiles.find((profile) => profile.name === renderModName(collection))
  );
}

export function fallbackProfile(
  state: IState,
  gameId: string,
  excludeId: string,
): IProfile | undefined {
  return gameProfiles(state, gameId)
    .filter((profile) => profile.id !== excludeId)
    .sort((lhs, rhs) => (rhs.lastActivated ?? 0) - (lhs.lastActivated ?? 0))[0];
}

function switchTo(api: IExtensionApi, profileId: string): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, 30_000);
    api.events.once("profile-did-change", () => {
      clearTimeout(timer);
      resolve();
    });
    api.store.dispatch(setNextProfile(profileId));
  });
}

export async function removeCollectionProfile(
  api: IExtensionApi,
  profile: IProfile,
  fallback: IProfile,
): Promise<void> {
  if (api.getState().settings.profiles.activeProfileId === profile.id) {
    await switchTo(api, fallback.id);
  }

  // le dossier du profil (plugins.txt, ordre de chargement…) est mis de côté pour « Annuler »
  const folder = profilePath(profile);
  const kept = path.join(getVortexPath("userData"), profile.gameId, "removed profiles", profile.id);
  let hasCopy = false;
  try {
    await rm(kept, { recursive: true, force: true });
    await mkdir(path.dirname(kept), { recursive: true });
    await cp(folder, kept, { recursive: true });
    hasCopy = true;
  } catch (err) {
    log("info", "no profile folder to keep", {
      profile: profile.id,
      error: (err as Error).message,
    });
  }

  removeProfile(api, profile.id);

  api.sendNotification({
    id: `collection-profile-removed-${profile.id}`,
    type: "success",
    message: 'Profile "{{name}}" removed, back to "{{fallback}}"',
    replace: { name: profile.name, fallback: fallback.name },
    actions: [
      {
        title: "Undo",
        action: (dismiss) => {
          (hasCopy ? cp(kept, folder, { recursive: true }) : Promise.resolve())
            .then(() => {
              api.store.dispatch(setProfile({ ...profile, pendingRemove: undefined }));
              dismiss();
            })
            .catch((err) =>
              api.showErrorNotification("Failed to restore the profile", err, {
                allowReport: false,
              }),
            );
        },
      },
    ],
  });
}
