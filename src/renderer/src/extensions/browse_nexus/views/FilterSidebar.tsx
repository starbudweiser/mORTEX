/**
 * mORTEX : colonne de filtres du navigateur Nexus, comme celle de nexusmods.com. Chaque liste montre
 * le nombre de résultats de chaque valeur (compteurs de l'API) ; les champs texte et nombre
 * s'appliquent à la touche Entrée ou en quittant le champ.
 */
import React, { type ReactNode, useEffect, useMemo, useState } from "react";

import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { TextField } from "@/ui/components/form/text_field/TextField";
import { Icon } from "@/ui/components/icon/Icon";
import { Picker } from "@/ui/components/picker/Picker";
import { Pill } from "@/ui/components/pill/Pill";
import { Typography } from "@/ui/components/typography/Typography";
import { getCurrentLanguage } from "@/util/i18n";

import {
  activeFilterCount,
  EMPTY_FILTERS,
  type IBrowseFilters,
  type UpdatedWithin,
} from "../util/browseFilters";
import type { IFacets } from "../util/nexusMods";

type TFunction = (text: string, options?: Record<string, unknown>) => string;

interface IProps {
  kind: "mods" | "collections";
  filters: IBrowseFilters;
  facets: IFacets;
  t: TFunction;
  onChange: (filters: IBrowseFilters) => void;
}

const formatCount = (count: number) => count.toLocaleString(getCurrentLanguage());

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-t border-stroke-weak pt-3">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1 text-left"
        type="button"
        onClick={() => setOpen(!open)}
      >
        <Typography
          appearance="strong"
          className="font-semibold uppercase"
          typographyType="body-xs"
        >
          {title}
        </Typography>

        <Icon name={open ? "keyboard_arrow_up" : "keyboard_arrow_down"} size="sm" />
      </button>

      {open && <div className="space-y-2 pt-2 pb-3">{children}</div>}
    </section>
  );
}

/** cases à cocher, une par valeur, avec leur nombre de résultats */
function FacetList({
  counts,
  selected,
  sortByCount = false,
  emptyLabel,
  onChange,
}: {
  counts: Record<string, number> | undefined;
  selected: string[];
  sortByCount?: boolean;
  emptyLabel: string;
  onChange: (values: string[]) => void;
}) {
  const entries = useMemo(() => {
    const list = Object.entries(counts ?? {}).filter(
      ([name, count]) => name !== "" && (count > 0 || selected.includes(name)),
    );
    for (const name of selected) if (!(name in (counts ?? {}))) list.push([name, 0]);
    return list.sort(([lhsName, lhs], [rhsName, rhs]) =>
      sortByCount ? rhs - lhs || lhsName.localeCompare(rhsName) : lhsName.localeCompare(rhsName),
    );
  }, [counts, selected, sortByCount]);

  if (entries.length === 0) {
    return (
      <Typography appearance="subdued" typographyType="body-sm">
        {emptyLabel}
      </Typography>
    );
  }

  return (
    <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
      {entries.map(([name, count]) => (
        <CheckboxField
          checked={selected.includes(name)}
          key={name}
          label={
            <span>
              {name} <span className="text-neutral-subdued">({formatCount(count)})</span>
            </span>
          }
          onChange={(checked: boolean) =>
            onChange(checked ? [...selected, name] : selected.filter((value) => value !== name))
          }
        />
      ))}
    </div>
  );
}

/** tags à inclure (tous exigés) et à exclure, choisis dans la liste des tags des résultats */
function TagFilter({
  counts,
  include,
  exclude,
  t,
  onChange,
}: {
  counts: Record<string, number> | undefined;
  include: string[];
  exclude: string[];
  t: TFunction;
  onChange: (include: string[], exclude: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const tags = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return Object.entries(counts ?? {})
      .filter(
        ([name, count]) =>
          count > 0 &&
          !include.includes(name) &&
          !exclude.includes(name) &&
          (needle === "" || name.toLocaleLowerCase().includes(needle)),
      )
      .sort(([lhsName, lhs], [rhsName, rhs]) => rhs - lhs || lhsName.localeCompare(rhsName));
  }, [counts, include, exclude, search]);

  return (
    <>
      {include.length + exclude.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {include.map((tag) => (
            <Pill
              as="button"
              brand="success"
              icon="add"
              key={`+${tag}`}
              title={t("Remove this tag")}
              onClick={() =>
                onChange(
                  include.filter((value) => value !== tag),
                  exclude,
                )
              }
            >
              {tag}
            </Pill>
          ))}

          {exclude.map((tag) => (
            <Pill
              as="button"
              brand="danger"
              icon="remove"
              key={`-${tag}`}
              title={t("Remove this tag")}
              onClick={() =>
                onChange(
                  include,
                  exclude.filter((value) => value !== tag),
                )
              }
            >
              {tag}
            </Pill>
          ))}
        </div>
      )}

      <TextField
        hideLabel={true}
        label={t("Find a tag")}
        leftIcon="search"
        placeholder={t("Find a tag")}
        value={search}
        onChange={(evt) => setSearch(evt.target.value)}
      />

      <div className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
        {tags.map(([tag, count]) => (
          <div className="flex items-center gap-x-1" key={tag}>
            <span className="min-w-0 flex-1 truncate text-xs" title={tag}>
              {tag} <span className="text-neutral-subdued">({formatCount(count)})</span>
            </span>

            <Button
              appearance="subdued"
              brand="success"
              leftIcon="add"
              size="sm"
              title={t("Include: only results with this tag")}
              onClick={() => onChange([...include, tag], exclude)}
            />

            <Button
              appearance="subdued"
              brand="danger"
              leftIcon="remove"
              size="sm"
              title={t("Exclude: hide results with this tag")}
              onClick={() => onChange(include, [...exclude, tag])}
            />
          </div>
        ))}
      </div>
    </>
  );
}

/** champ appliqué à la touche Entrée ou en le quittant, pour ne pas relancer la recherche à chaque lettre */
function CommitField({
  label,
  value,
  numeric = false,
  onCommit,
}: {
  label: string;
  value: string;
  numeric?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <TextField
      inputMode={numeric ? "decimal" : undefined}
      label={label}
      value={draft}
      onBlur={commit}
      onChange={(evt) =>
        setDraft(numeric ? evt.target.value.replace(/[^\d.,]/g, "") : evt.target.value)
      }
      onKeyDown={(evt) => {
        if (evt.key === "Enter") commit();
      }}
    />
  );
}

export function FilterSidebar({ kind, filters, facets, t, onChange }: IProps) {
  const set = <K extends keyof IBrowseFilters>(key: K, value: IBrowseFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const active = activeFilterCount(filters);

  const updatedOptions = useMemo(
    () =>
      (
        [
          ["", "Any time"],
          ["day", "Last 24 hours"],
          ["week", "Last 7 days"],
          ["month", "Last 30 days"],
          ["year", "Last year"],
        ] as Array<[UpdatedWithin, string]>
      ).map(([value, label]) => ({ value, label: t(label) })),
    [t],
  );
  const ratingOptions = useMemo(
    () =>
      [
        ["", t("Any rating")],
        ["50", "≥ 50 %"],
        ["70", "≥ 70 %"],
        ["85", "≥ 85 %"],
      ].map(([value, label]) => ({ value, label })),
    [t],
  );

  return (
    <aside aria-label={t("Filters")} className="w-72 shrink-0 space-y-1">
      {active > 0 && (
        <Button
          appearance="subdued"
          brand="neutral"
          className="mb-2"
          leftIcon="close"
          size="sm"
          onClick={() => onChange(EMPTY_FILTERS)}
        >
          {t("Clear filters ({{count}})", { replace: { count: active } })}
        </Button>
      )}

      <Section title={t("Category")}>
        <FacetList
          counts={facets.categoryName}
          emptyLabel={t("No category")}
          selected={filters.categories}
          onChange={(values) => set("categories", values)}
        />
      </Section>

      <Section title={t("Tags")}>
        <TagFilter
          counts={facets.tag}
          exclude={filters.tagsExclude}
          include={filters.tagsInclude}
          t={t}
          onChange={(include, exclude) =>
            onChange({ ...filters, tagsInclude: include, tagsExclude: exclude })
          }
        />
      </Section>

      {kind === "mods" ? (
        <>
          <Section title={t("Search parameters")}>
            <CommitField
              label={t("Description contains")}
              value={filters.description}
              onCommit={(value) => set("description", value)}
            />

            <CommitField
              label={t("Author")}
              value={filters.author}
              onCommit={(value) => set("author", value)}
            />

            <CommitField
              label={t("Uploader")}
              value={filters.uploader}
              onCommit={(value) => set("uploader", value)}
            />
          </Section>

          <Section title={t("Language")}>
            <FacetList
              counts={facets.languageName}
              emptyLabel={t("No language")}
              selected={filters.languages}
              sortByCount={true}
              onChange={(values) => set("languages", values)}
            />
          </Section>

          <Section title={t("Popularity")}>
            <CommitField
              label={t("Downloads (minimum)")}
              numeric={true}
              value={filters.minDownloads}
              onCommit={(value) => set("minDownloads", value)}
            />

            <CommitField
              label={t("Endorsements (minimum)")}
              numeric={true}
              value={filters.minEndorsements}
              onCommit={(value) => set("minEndorsements", value)}
            />
          </Section>

          <Section title={t("File size (MB)")}>
            <div className="flex gap-x-2">
              <CommitField
                label={t("Minimum")}
                numeric={true}
                value={filters.minSizeMB}
                onCommit={(value) => set("minSizeMB", value)}
              />

              <CommitField
                label={t("Maximum")}
                numeric={true}
                value={filters.maxSizeMB}
                onCommit={(value) => set("maxSizeMB", value)}
              />
            </div>
          </Section>

          <Section title={t("Last updated")}>
            <Picker
              options={updatedOptions}
              value={filters.updatedWithin}
              onChange={(value) => set("updatedWithin", value)}
            />

            <CheckboxField
              checked={filters.onlyUpdated}
              label={t("Updated at least once since release")}
              onChange={(checked: boolean) => set("onlyUpdated", checked)}
            />
          </Section>
        </>
      ) : (
        <>
          <Section title={t("Game version")}>
            <FacetList
              counts={facets.gameVersion}
              emptyLabel={t("No version")}
              selected={filters.gameVersions}
              sortByCount={true}
              onChange={(values) => set("gameVersions", values)}
            />
          </Section>

          <Section title={t("Success rating")}>
            <Picker
              options={ratingOptions}
              value={filters.minRating}
              onChange={(value) => set("minRating", value)}
            />
          </Section>

          <Section title={t("Badges")}>
            <CheckboxField
              checked={filters.withBadge}
              label={t("Only collections with a Nexus badge (easy install, top pick)")}
              onChange={(checked: boolean) => set("withBadge", checked)}
            />
          </Section>
        </>
      )}
    </aside>
  );
}
