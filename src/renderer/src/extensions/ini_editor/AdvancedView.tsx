/**
 * mORTEX (macOS) : la page Avancé de l'Éditeur de réglages. Tous les réglages que SkyrimSE.exe connaît,
 * plus ceux des INI qu'il ne connaît pas, avec recherche. Chaque ligne montre la valeur actuelle, la
 * valeur de Bethesda quand elle est connue et le fichier d'origine ; un double-clic sur la valeur la
 * modifie (un nom inconnu reste modifiable en texte).
 */
import React, { useMemo, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { Input } from "@/ui/components/form/input/Input";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Typography } from "@/ui/components/typography/Typography";

import { INI_FILE_NAMES, settingId } from "../../util/macos/iniEdit";
import type { ICatalogSetting } from "./catalog/types";
import {
  type IAdvancedEntry,
  type IValueContext,
  advancedEntries,
  filterEntries,
  isValidRaw,
  pendingEntryValue,
  rawBase,
} from "./model";
import type { SettingsTranslate } from "./SettingRow";

const PAGE_SIZE = 150;
const COLUMNS = "grid grid-cols-[8rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_9rem] gap-x-3";

interface IProps {
  exe: ReadonlyArray<readonly [string, string]>;
  catalog: readonly ICatalogSetting[];
  ctx: IValueContext;
  tt: SettingsTranslate;
  onChange: (section: string, key: string, value: string) => void;
}

function ValueCell({
  entry,
  value,
  modified,
  tt,
  onChange,
}: {
  entry: IAdvancedEntry;
  value: string | undefined;
  modified: boolean;
  tt: SettingsTranslate;
  onChange: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const start = () => {
    setDraft(value ?? "");
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    if (isValidRaw(entry.key, draft) && draft.trim() !== (value ?? "")) onChange(draft.trim());
  };

  if (editing) {
    const invalid = draft.trim() !== "" && !isValidRaw(entry.key, draft);
    return (
      <Input
        autoFocus
        aria-label={`${entry.section} ${entry.key}`}
        className="w-full"
        invalid={invalid}
        value={draft}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
          if (event.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <Typography
      className={`min-h-6 cursor-text truncate rounded-sm px-2 py-0.5 hover:bg-surface-high ${modified ? "font-semibold" : ""}`}
      title={tt("ui.advEditHint")}
      typographyType="body-sm"
      onDoubleClick={start}
    >
      {value === undefined ? "—" : value === "" ? tt("ui.advEmpty") : value}
    </Typography>
  );
}

export default function AdvancedView({ exe, catalog, ctx, tt, onChange }: IProps) {
  const [query, setQuery] = useState("");
  const [onlyDefined, setOnlyDefined] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const entries = useMemo(() => advancedEntries(exe, ctx.effective), [exe, ctx.effective]);
  const matching = useMemo(
    () => filterEntries(entries, ctx, catalog, { query, onlyDefined }),
    [entries, ctx, catalog, query, onlyDefined],
  );
  const shown = matching.slice(0, limit);

  return (
    <div className="flex flex-col gap-y-3" data-testid="settings-advanced">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Input
          aria-label={tt("ui.advSearch")}
          className="w-96"
          placeholder={tt("ui.advSearch")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(PAGE_SIZE);
          }}
        />
        <label className="flex items-center gap-x-2">
          <Switch
            aria-label={tt("ui.advOnlyDefined")}
            checked={onlyDefined}
            onChange={(checked) => {
              setOnlyDefined(checked);
              setLimit(PAGE_SIZE);
            }}
          />
          <Typography typographyType="body-sm">{tt("ui.advOnlyDefined")}</Typography>
        </label>
        <Typography appearance="subdued" className="ml-auto" typographyType="body-sm">
          {tt("ui.advCount", { shown: shown.length, total: matching.length })}
        </Typography>
      </div>
      <Typography appearance="subdued" typographyType="body-xs">
        {tt("ui.advEditHint")}
      </Typography>

      <div className="rounded-md bg-surface-mid p-3">
        <div className={`${COLUMNS} px-2 pb-2`}>
          {["advColSection", "advColKey", "advColValue", "advColBethesda", "advColFile"].map(
            (id) => (
              <Typography
                appearance="subdued"
                className={`font-semibold ${id === "advColValue" ? "pl-2" : ""}`}
                key={id}
                typographyType="body-xs"
              >
                {tt(`ui.${id}`)}
              </Typography>
            ),
          )}
        </div>
        {shown.length === 0 && (
          <Typography appearance="subdued" className="px-2 py-4" typographyType="body-sm">
            {tt("ui.advNone")}
          </Typography>
        )}
        {shown.map((entry) => {
          const id = settingId(entry.section, entry.key);
          const pendingValue = pendingEntryValue(ctx, catalog, entry.section, entry.key);
          const modified = pendingValue !== undefined;
          const origin = ctx.effective.get(id);
          const value = pendingValue ?? rawBase(ctx, entry.section, entry.key);
          return (
            <div
              className={`${COLUMNS} items-center rounded-sm px-2 py-0.5 ${modified ? "bg-success-weak/40" : "hover:bg-surface-high"}`}
              data-testid={`settings-advanced-${id}`}
              key={id}
            >
              <Typography appearance="moderate" className="truncate" typographyType="body-sm">
                {entry.section}
              </Typography>
              <Typography className="truncate" typographyType="body-sm">
                {entry.key}
                {!entry.known && (
                  <span className="ml-2 text-xs text-warning-strong" title={tt("ui.advUnknown")}>
                    ?
                  </span>
                )}
              </Typography>
              <ValueCell
                entry={entry}
                modified={modified}
                tt={tt}
                value={value}
                onChange={(next) => onChange(entry.section, entry.key, next)}
              />
              <Typography appearance="subdued" className="truncate" typographyType="body-sm">
                {ctx.defaults.get(id) ?? "—"}
              </Typography>
              <Typography appearance="subdued" className="truncate" typographyType="body-sm">
                {origin !== undefined ? INI_FILE_NAMES[origin.role] : "—"}
              </Typography>
            </div>
          );
        })}
        {matching.length > shown.length && (
          <div className="px-2 pt-3">
            <Button size="sm" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
              {tt("ui.advMore", { count: matching.length - shown.length })}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
