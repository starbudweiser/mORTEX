/**
 * mORTEX (macOS) : la liste des sauvegardes des INI, de la plus récente à la plus ancienne. Restaurer
 * remet les fichiers de la copie (l'état actuel est copié avant, donc la restauration s'annule).
 */
import React from "react";

import { Button } from "@/ui/components/button/Button";
import { Typography } from "@/ui/components/typography/Typography";

import type { IBackup } from "./backup";
import type { SettingsTranslate } from "./SettingRow";

interface IProps {
  backups: readonly IBackup[];
  tt: SettingsTranslate;
  onRestore: (backup: IBackup) => void;
  onReveal: (backup: IBackup) => void;
}

export default function BackupsView({ backups, tt, onRestore, onReveal }: IProps) {
  return (
    <div className="flex max-w-4xl flex-col gap-y-3" data-testid="settings-backups">
      <Typography appearance="moderate" typographyType="body-md">
        {tt("ui.bkIntro")}
      </Typography>
      {backups.length === 0 ? (
        <Typography appearance="subdued" typographyType="body-md">
          {tt("ui.bkEmpty")}
        </Typography>
      ) : (
        <div className="rounded-md bg-surface-mid p-3">
          {backups.map((backup) => (
            <div
              className="flex items-center gap-x-4 rounded-sm px-2 py-2 hover:bg-surface-high"
              data-testid={`settings-backup-${backup.name}`}
              key={backup.name}
            >
              <div className="min-w-0 flex-1">
                <Typography className="font-semibold" typographyType="body-md">
                  {backup.name}
                </Typography>
                <Typography appearance="subdued" typographyType="body-xs">
                  {tt("ui.bkFiles", { files: backup.files.join(", ") })}
                </Typography>
              </div>
              <Button leftIcon="history" size="sm" onClick={() => onRestore(backup)}>
                {tt("ui.bkRestore")}
              </Button>
              <Button
                appearance="moderate"
                brand="neutral"
                leftIcon="folder_open"
                size="sm"
                onClick={() => onReveal(backup)}
              >
                {tt("ui.bkReveal")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
