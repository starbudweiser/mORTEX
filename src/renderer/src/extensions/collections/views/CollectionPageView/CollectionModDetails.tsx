import type { ICollectionRevisionMod } from "@nexusmods/nexus-api";
import * as React from "react";

import bbcodeToReact from "../../../../controls/bbcode";
import { getGame } from "../../../../extensions/gamemode_management/util/getGame";
import renderModName from "../../../../extensions/mod_management/util/modName";
import { nexusGameId } from "../../../../extensions/nexus_integration/util/convertGameId";
import type { TFunction } from "../../../../util/i18n";
import opn from "../../../../util/opn";
import { AUTHOR_UNKNOWN, NEXUS_BASE_URL } from "../../constants";
import type { IModEx } from "../../types/IModEx";

export interface ICollectionModDetails {
  t: TFunction;
  local?: IModEx;
  remote?: ICollectionRevisionMod;
  gameId: string;
  /** barre posée en haut de l'image : collection, position, fermeture */
  children?: React.ReactNode;
}

function CollectionModDetails(props: ICollectionModDetails) {
  const { t, children, gameId, local, remote } = props;

  const uploaderName = local?.attributes?.uploader ?? remote?.file?.owner?.name ?? AUTHOR_UNKNOWN;
  const uploaderId = local?.attributes?.uploaderId ?? remote?.file?.owner?.memberId;
  const authorName = local?.attributes?.author ?? remote?.file?.mod?.author ?? AUTHOR_UNKNOWN;
  const modTitle = renderModName(local) ?? remote?.file?.mod?.name ?? "";
  const version = local?.attributes?.version ?? remote?.file?.version ?? "???";
  const description = local?.attributes?.shortDescription ?? remote?.file?.mod?.summary ?? "";
  const image = local?.attributes?.pictureUrl ?? remote?.file?.mod?.pictureUrl;

  const domainName =
    remote?.file?.game?.domainName ?? nexusGameId(getGame(local?.attributes?.gameId ?? gameId));
  const modId = local?.attributes?.modId ?? remote?.file?.modId;

  const visitUploader = React.useCallback(() => {
    opn(`${NEXUS_BASE_URL}/users/${uploaderId}`);
  }, [uploaderId]);

  const visitPage = React.useCallback(() => {
    opn(`${NEXUS_BASE_URL}/${domainName}/mods/${modId}`);
  }, [domainName, modId]);

  return (
    <div className="collection-mod-hero">
      {image ? <img alt="" className="collection-mod-hero-image" src={image} /> : null}

      {children}

      <div className="collection-mod-caption">
        <div className="installing-mod-title">{modTitle}</div>

        {description ? (
          <div className="collection-description">{bbcodeToReact(description)}</div>
        ) : null}

        <div className="collection-mod-meta">
          <span>
            {t("Uploaded by")}{" "}
            {uploaderName !== AUTHOR_UNKNOWN ? (
              <a onClick={visitUploader}>{uploaderName}</a>
            ) : (
              <b>{uploaderName}</b>
            )}
          </span>

          <span>
            {t("Created by")} <b>{authorName}</b>
          </span>

          <span>
            {t("Version")} <b>{version}</b>
          </span>

          {modId !== undefined ? <a onClick={visitPage}>{t("View on Nexus Mods")}</a> : null}
        </div>
      </div>
    </div>
  );
}

export default CollectionModDetails;
