/**
 * mORTEX (macOS) : une ligne de l'Éditeur de réglages. Le contrôle suit le type du réglage ; une
 * ligne modifiée et non enregistrée prend un fond doux, une ligne dépendante d'un réglage désactivé
 * est grisée. La bulle donne l'aide, la note Mac et la ligne exacte qui serait écrite.
 */
import React, { useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Select } from "@/ui/components/form/select/Select";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";

import { INI_FILE_NAMES } from "../../util/macos/iniEdit";
import type { ICatalogSetting } from "./catalog/types";
import {
  type IValueContext,
  baseValue,
  currentValue,
  isTruthy,
  isValid,
  sameValue,
  targetRole,
  writtenLine,
} from "./model";

export type SettingsTranslate = (key: string, replace?: Record<string, unknown>) => string;

interface IProps {
  setting: ICatalogSetting;
  ctx: IValueContext;
  enabled: boolean;
  /** libellé du réglage dont celui-ci dépend, pour la bulle */
  dependsOnLabel?: string;
  tt: SettingsTranslate;
  onChange: (value: string) => void;
  onReset: () => void;
}

function Control({
  setting,
  value,
  enabled,
  label,
  tt,
  onChange,
}: {
  setting: ICatalogSetting;
  value: string | undefined;
  enabled: boolean;
  label: string;
  tt: SettingsTranslate;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");

  switch (setting.type) {
    case "bool":
      return (
        <Switch
          aria-label={label}
          checked={isTruthy(value)}
          disabled={!enabled}
          onChange={(checked) => onChange(checked ? "1" : "0")}
        />
      );
    case "choice": {
      const options = setting.options ?? [];
      const known = options.some((o) => sameValue(setting, o.value, value));
      return (
        <Select
          aria-label={label}
          disabled={!enabled}
          value={options.find((o) => sameValue(setting, o.value, value))?.value ?? value ?? ""}
          onChange={(event) => onChange(event.target.value)}
        >
          {value === undefined && <option value="" />}
          {!known && value !== undefined && <option value={value}>{value}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label ?? tt(`options.${setting.id}.${o.value}`)}
            </option>
          ))}
        </Select>
      );
    }
    case "int":
    case "float": {
      const invalid = draft.trim() !== "" && !isValid(setting, draft);
      return (
        <div className="flex flex-col items-end gap-y-1">
          <div className="flex items-center gap-x-2">
            <Input
              aria-label={label}
              className="w-32 text-right"
              disabled={!enabled}
              invalid={invalid}
              max={setting.max}
              min={setting.min}
              step={setting.step}
              type="number"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                if (isValid(setting, event.target.value)) onChange(event.target.value);
              }}
            />
            {setting.unit !== undefined && (
              <Typography appearance="subdued" typographyType="body-sm">
                {setting.unit}
              </Typography>
            )}
          </div>
          {invalid && (
            <Typography brand="danger" typographyType="body-xs">
              {tt("ui.invalidRange", { min: setting.min, max: setting.max })}
            </Typography>
          )}
        </div>
      );
    }
    case "text":
      return (
        <Input
          aria-label={label}
          className="w-64"
          disabled={!enabled}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (isValid(setting, event.target.value)) onChange(event.target.value);
          }}
        />
      );
  }
}

export default function SettingRow({
  setting,
  ctx,
  enabled,
  dependsOnLabel,
  tt,
  onChange,
  onReset,
}: IProps) {
  const label = tt(`label.${setting.id}`);
  const value = currentValue(ctx, setting);
  const modified = ctx.pending[setting.id] !== undefined;
  const effective = ctx.effective.get(`${setting.section}\u0000${setting.key}`.toLowerCase());
  const origin =
    effective !== undefined
      ? tt("ui.usedFile", { file: INI_FILE_NAMES[effective.role] })
      : baseValue(ctx, setting) !== undefined
        ? tt("ui.defaultValue")
        : tt("ui.notSet");

  const tip = (
    <div className="nxm-tooltip-content flex max-w-72 flex-col gap-y-1">
      <p className="font-semibold">{label}</p>
      <p>{tt(`help.${setting.id}`)}</p>
      {setting.macNote === true && (
        <p>
          <span className="font-semibold">{tt("ui.macTitle")}</span> {tt(`macNote.${setting.id}`)}
        </p>
      )}
      {dependsOnLabel !== undefined && <p>{tt("ui.dependsOn", { name: dependsOnLabel })}</p>}
      <p className="text-xs">{origin}</p>
      <p className="font-mono text-xs">
        {value !== undefined
          ? writtenLine(setting, value, ctx)
          : `[${setting.section}] ${setting.key} → ${INI_FILE_NAMES[targetRole(setting, ctx)]}`}
      </p>
    </div>
  );

  return (
    <div
      className={`flex items-center gap-x-4 rounded-md px-3 py-2 ${modified ? "bg-success-weak" : ""} ${enabled ? "" : "opacity-50"}`}
      data-testid={`settings-row-${setting.id}`}
    >
      <Tooltip customContent={tip} placement="right">
        <div className="flex min-w-0 flex-1 flex-col">
          <Typography className="font-semibold" typographyType="body-md">
            {label}
          </Typography>
          <Typography appearance="subdued" typographyType="body-xs">
            {modified ? `${tt("ui.modified")} · ` : ""}
            {origin}
          </Typography>
        </div>
      </Tooltip>
      <Control
        enabled={enabled}
        label={label}
        setting={setting}
        tt={tt}
        value={value}
        onChange={onChange}
      />
      <div className="w-8">
        {modified && (
          <Button
            appearance="moderate"
            brand="neutral"
            leftIcon="undo"
            size="sm"
            title={tt("ui.resetOne")}
            onClick={onReset}
          />
        )}
      </div>
    </div>
  );
}
