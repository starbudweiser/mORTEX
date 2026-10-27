/**
 * mORTEX : tuile d'un mod dans l'onglet Mods du navigateur Nexus, sur le modèle de CollectionTile.
 * Image, nom, auteur, catégorie, approbations, téléchargements, taille et résumé ; « Télécharger »
 * et « Voir la page ». Un mod déjà installé ou en cours de téléchargement le dit.
 */
import numeral from "numeral";
import React, { type PropsWithChildren, useState } from "react";

import { Bullet } from "@/ui/components/bullet/Bullet";
import { Button } from "@/ui/components/button/Button";
import { Icon, type IIconSource } from "@/ui/components/icon/Icon";
import { getIconProps } from "@/ui/components/icon/utils/icon_props/iconProps.util";
import { Image } from "@/ui/components/image/Image";
import { Typography } from "@/ui/components/typography/Typography";

import type { INexusModSummary } from "../util/nexusMods";

export type ModTileStatus = "installed" | "downloaded" | undefined;

interface IModTileProps {
  mod: INexusModSummary;
  t: (text: string, options?: Record<string, unknown>) => string;
  status: ModTileStatus;
  isLoggedIn: boolean;
  onDownload: () => Promise<void>;
  onViewPage: () => void;
}

const Stat = ({
  children,
  icon,
  title,
}: PropsWithChildren<{ icon: IIconSource; title: string }>) => (
  <div className="flex items-center gap-x-1" title={title}>
    <Icon {...getIconProps(icon)} className="text-neutral-subdued" size="sm" />

    <Typography appearance="moderate" typographyType="body-sm">
      {children}
    </Typography>
  </div>
);

export function ModTile({ mod, t, status, isLoggedIn, onDownload, onViewPage }: IModTileProps) {
  const [pending, setPending] = useState(false);

  const download = () => {
    if (pending) return;
    setPending(true);
    onDownload().finally(() => setPending(false));
  };

  return (
    <div className="w-full rounded-md bg-surface-mid" data-testid="mod-tile">
      <div className="flex items-start gap-x-3.5 p-3">
        <Image
          alt={mod.name}
          className="aspect-video w-full max-w-40 rounded-xs"
          fit="cover"
          imageType="mod"
          src={mod.thumbnailUrl}
        />

        <div className="flex min-w-0 grow flex-col gap-y-1.5">
          <div className="flex flex-col gap-y-1">
            <Typography
              className="truncate font-semibold"
              title={mod.name}
              typographyType="body-lg"
            >
              {mod.name}
            </Typography>

            <Typography appearance="moderate" className="truncate" typographyType="body-sm">
              {t("by {{author}}", { replace: { author: mod.author } })}
              {mod.version ? ` · v${mod.version}` : ""}
            </Typography>
          </div>

          <div className="flex items-center gap-x-1.5 border-t border-stroke-weak pt-1.5">
            <Typography brand="info" typographyType="body-sm">
              {mod.category}
            </Typography>

            {mod.adultContent && (
              <>
                <Bullet />

                <Typography brand="danger" typographyType="body-sm">
                  {t("Adult")}
                </Typography>
              </>
            )}

            {status !== undefined && (
              <>
                <Bullet />

                <Typography
                  brand="success"
                  className="flex items-center gap-x-1"
                  typographyType="body-sm"
                >
                  <Icon name="check" size="xs" />
                  {status === "installed" ? t("Installed") : t("Downloaded")}
                </Typography>
              </>
            )}
          </div>

          <div className="flex items-center gap-x-5 border-t border-stroke-weak pt-1.5">
            <Stat icon={{ name: "thumb_up", filled: true }} title={t("Endorsements")}>
              {numeral(mod.endorsements).format("0 a")}
            </Stat>

            <Stat icon={{ name: "download" }} title={t("Downloads")}>
              {numeral(mod.downloads).format("0 a")}
            </Stat>

            <Stat icon={{ name: "hard_drive", filled: true }} title={t("Size")}>
              {numeral(mod.fileSize).format("0.0 b")}
            </Stat>
          </div>

          <Typography
            appearance="subdued"
            className="line-clamp-3 border-t border-stroke-weak pt-1.5 wrap-break-word"
            typographyType="body-sm"
          >
            {mod.summary}
          </Typography>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-x-2 rounded-b bg-surface-translucent-low px-3 py-2">
        {/* fond selon l'action : télécharger (bleu), retélécharger un mod déjà là (vert, comme la
            mention « Téléchargé »), voir la page (navigation, gris) */}
        <Button
          brand={status === undefined ? "primary" : "success"}
          disabled={!isLoggedIn}
          isLoading={pending}
          leftIcon={status === undefined ? "download" : "refresh"}
          size="sm"
          title={isLoggedIn ? undefined : t("Log in to Nexus Mods to download mods")}
          onClick={download}
        >
          {status === undefined ? t("Download") : t("Download again")}
        </Button>

        <Button
          appearance="moderate"
          brand="neutral"
          leftIcon="open_in_new"
          size="sm"
          onClick={onViewPage}
        >
          {t("View page")}
        </Button>
      </div>
    </div>
  );
}
