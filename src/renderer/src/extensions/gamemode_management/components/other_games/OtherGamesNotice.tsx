/**
 * mORTEX (macOS) : remplace la liste des centaines de jeux pris en charge par Vortex. Cette
 * version a d'abord été développée pour Skyrim ; les autres jeux restent masqués, avec une
 * explication.
 */
import React from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "@/ui/components/icon/Icon";
import { Typography } from "@/ui/components/typography/Typography";

import { Section } from "../section/Section";

export const OtherGamesNotice = () => {
  const { t } = useTranslation();
  return (
    <Section count="" testId="other-games-notice" title={t("Other games")}>
      <div className="flex items-start gap-x-3 rounded-lg bg-surface-mid p-4">
        <Icon className="mt-0.5 shrink-0 text-info-strong" name="info" size="md" />
        <div className="flex flex-col gap-y-2">
          <Typography typographyType="body-md">
            {t(
              "The other games supported by Vortex are potentially compatible, but this version of mORTEX was developed for Skyrim first. They are hidden for now.",
            )}
          </Typography>
          <Typography appearance="moderate" typographyType="body-md">
            {t("Development will continue and may open up to the other games supported by Vortex.")}
          </Typography>
        </div>
      </div>
    </Section>
  );
};
