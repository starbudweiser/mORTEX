import path from "path";

import React, { type ReactNode, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import { resolveCategoryName } from "@/extensions/category_management/util/retrieveCategoryPath";
import type { IState } from "@/types/IState";
import { Button } from "@/ui/components/button/Button";
import { Image } from "@/ui/components/image/Image";
import { getCurrentLanguage } from "@/util/i18n";
import { bytesToString } from "@/util/util";

import { ModCrashes } from "../../../mortex_crashes/ModCrashes";
import type { IMod } from "../../types/IMod";
import { modAuthor } from "../mod_author/ModAuthor";

interface IModInspectorProps {
  /** The mod it's about. */
  mod: IMod;
  /** The name its row shows, for a mod without its page's title. */
  name: string;
  /** Opens its page on Nexus Mods; unset when it has none. */
  onOpenNexus?: () => void;
  /** Shows its folder in the Finder; unset when it isn't installed. */
  onOpenFolder?: () => void;
  /** Opens the file conflict editor; unset when the mod has no conflicts. */
  onOpenConflicts?: () => void;
  /** Closes the panel, from its button or Escape. */
  onClose: () => void;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt>{label}</dt>
    <dd>{children}</dd>
  </>
);

/**
 * mORTEX : la fiche d'un mod, ancrée à droite de la liste comme l'inspecteur des Plugins (le
 * panneau de détails de l'ancienne interface) : image, version, auteur, catégorie, source,
 * archive et dossier, avec de quoi ouvrir sa page Nexus Mods. En lecture seule.
 */
export const ModInspector = ({
  mod,
  name,
  onOpenNexus,
  onOpenFolder,
  onOpenConflicts,
  onClose,
}: IModInspectorProps) => {
  const { t } = useTranslation(["common"]);
  const attributes = mod.attributes ?? {};

  const archive = useSelector((state: IState) =>
    mod.archiveId === undefined ? undefined : state.persistent.downloads.files[mod.archiveId],
  );
  const category = useSelector((state: IState) =>
    attributes.category === undefined ? "" : resolveCategoryName(attributes.category, state),
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const author = modAuthor(mod);
  const nexusId =
    attributes.source === "nexus" && attributes.modId !== undefined
      ? [attributes.modId, attributes.fileId].filter((id) => id !== undefined).join(" / ")
      : undefined;
  const installed =
    attributes.installTime === undefined
      ? undefined
      : new Date(attributes.installTime).toLocaleString(getCurrentLanguage(), {
          dateStyle: "medium",
          timeStyle: "short",
        });
  let source: string = t("Local file");
  if (attributes.source === "nexus") {
    source = "Nexus Mods";
  } else if (attributes.source === "website") {
    source = t("Website");
  }

  return (
    <aside aria-label={t("Mod information")} className="mortex-inspector">
      <div className="mortex-inspector-head">
        <h4>{attributes.modName || name}</h4>
        <Button
          appearance="weak"
          aria-label={t("Close")}
          brand="neutral"
          leftIcon="close"
          size="sm"
          onClick={onClose}
        />
      </div>

      {[attributes.version, author].some(Boolean) && (
        <small>{[attributes.version, author].filter(Boolean).join(" · ")}</small>
      )}

      {!!attributes.pictureUrl && (
        <Image
          alt=""
          className="mortex-inspector-picture"
          fallbackIcon="broken_image"
          fit="cover"
          imageType="mod"
          src={attributes.pictureUrl}
        />
      )}

      {!!attributes.shortDescription && <p>{attributes.shortDescription}</p>}

      <dl className="mortex-inspector-fields">
        {!!category && <Field label={t("Category")}>{category}</Field>}
        <Field label={t("Source")}>{source}</Field>
        {!!nexusId && <Field label={t("Nexus ID")}>{nexusId}</Field>}
        {!!installed && <Field label={t("Installed")}>{installed}</Field>}
        {!!archive?.localPath && (
          <Field label={t("Archive")}>
            {path.basename(archive.localPath)}
            {!!archive.size && ` (${bytesToString(archive.size)})`}
          </Field>
        )}
        {!!mod.installationPath && <Field label={t("Folder")}>{mod.installationPath}</Field>}
        {!!attributes.notes && <Field label={t("Notes")}>{attributes.notes}</Field>}
      </dl>

      <ModCrashes mod={mod} onOpenConflicts={onOpenConflicts} />

      <div className="mortex-inspector-actions">
        {onOpenNexus !== undefined && (
          <Button leftIcon="open_in_new" size="sm" onClick={onOpenNexus}>
            {t("Open on Nexus Mods")}
          </Button>
        )}
        {onOpenFolder !== undefined && (
          <Button appearance="moderate" brand="neutral" size="sm" onClick={onOpenFolder}>
            {t("Show in Finder")}
          </Button>
        )}
      </div>
    </aside>
  );
};
