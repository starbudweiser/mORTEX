import React, { type ReactNode, useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import type { ITableRowAction } from "@/controls/Table";
import { ExtensionContext } from "@/ExtensionProvider";
import { activeGameId } from "@/extensions/profile_management/selectors";
import type { IState } from "@/types/IState";
import { useDisplayOptionsAction } from "@/ui/components/display_options/useDisplayOptionsAction.hook";
import { DropdownBlock } from "@/ui/components/dropdown/DropdownBlock";
import { DropdownDivider } from "@/ui/components/dropdown/DropdownDivider";
import { Switch } from "@/ui/components/form/switch/Switch";
import { Image } from "@/ui/components/image/Image";
import { NoResults } from "@/ui/components/no_results/NoResults";
import { Table } from "@/ui/components/table/Table";
import type { ITableSort } from "@/ui/components/table/Table.types";
import { TableSelectionBar } from "@/ui/components/table/table_selection_bar/TableSelectionBar";
import { Toolbar } from "@/ui/components/toolbar/Toolbar";
import { ToolbarGroup } from "@/ui/components/toolbar/ToolbarGroup";
import { ToolbarMenu } from "@/ui/components/toolbar/ToolbarMenu";
import { useToolbarAnalytics } from "@/ui/components/toolbar/useToolbarAnalytics.hook";
import { Typography } from "@/ui/components/typography/Typography";

import { useCollectionGroupActions } from "../../hooks/use_collection_group_actions/useCollectionGroupActions.hook";
import { useGroupEnabled } from "../../hooks/use_group_enabled/useGroupEnabled.hook";
import { useInstallMods } from "../../hooks/use_install_mods/useInstallMods.hook";
import {
  MOD_ROW_PINNING_ID,
  MOD_SELECTION_PINNING_ID,
  useModRowActions,
  useModSelectionActions,
} from "../../hooks/use_mod_actions/useModActions.hook";
import { useModsEnabled } from "../../hooks/use_mods_enabled/useModsEnabled.hook";
import {
  MODS_TABLE_TOOLBARS,
  modsTableGroupToolbar,
  useModsTableAnalytics,
} from "../../hooks/use_mods_table_analytics/useModsTableAnalytics.hook";
import {
  type IModsTableColumn,
  useModsTableColumns,
} from "../../hooks/use_mods_table_columns/useModsTableColumns.hook";
import { useModsTableDataColumns } from "../../hooks/use_mods_table_data_columns/useModsTableDataColumns.hook";
import { useModsTableFocusRequest } from "../../hooks/use_mods_table_focus_request/useModsTableFocusRequest.hook";
import {
  useCollectionMemberships,
  useModsTableGroups,
} from "../../hooks/use_mods_table_groups/useModsTableGroups.hook";
import { useModsTableSearch } from "../../hooks/use_mods_table_search/useModsTableSearch.hook";
import { useModsTableView } from "../../hooks/use_mods_table_view/useModsTableView.hook";
import type { IModWithState } from "../../types/IModProps";
import { modHasUpdate } from "../../util/mod_has_update/modHasUpdate";
import {
  allModRows,
  type IModGroup,
  type IModRow,
} from "../../util/mods_table_views/modsTableViews";
import { CollectionHoverCard } from "../collection_hover_card/CollectionHoverCard";
import { CollectionRevision } from "../collection_revision/CollectionRevision";
import { DisableSharedModsModal } from "../disable_shared_mods_modal/DisableSharedModsModal";
import { ModHoverCard } from "../mod_hover_card/ModHoverCard";
import { ModInspector } from "../mod_inspector/ModInspector";
import {
  actionsWidth,
  ModRowActions,
  ModRowToggle,
  PINNED_ACTION_WIDTH,
} from "../mod_row_actions/ModRowActions";
import { ModStatusPill, modStatusKind } from "../mod_status_pill/ModStatusPill";
import { ModVersion, modVersionGroup, modVersionText } from "../mod_version/ModVersion";
import { ModsTableColumnToggles } from "../mods_table_column_toggles/ModsTableColumnToggles";
import { ModsTableGroupBy } from "../mods_table_group_by/ModsTableGroupBy";
import { ModsTableToolbar, type ModsQuickFilter } from "../mods_table_toolbar/ModsTableToolbar";

interface IModsTableSwitchProps {
  /** The mods, collections among them: the collections head their groups, never rows. */
  mods: { [id: string]: IModWithState };
  /** The table shown unless the user has switched to the beta view. */
  legacy: ReactNode;
  /** Enables or disables mods, installing any that are only downloaded first; settles once done. */
  onSetModsEnabled: (modIds: string[], enabled: boolean) => void | PromiseLike<unknown>;
  /** The legacy table's row actions, offered in each row's menu with the extensions' own. */
  rowActions?: ITableRowAction[];
  /** Each listed mod's installed versions and variants, itself included, by its id. */
  alternatives?: { [modId: string]: IModWithState[] };
  /** Switches from a mod to another of its versions or variants, by id. */
  onSelectVersion?: (modId: string, alternativeId: string) => void;
  /** Removes one of a mod's versions or variants, by id, asking first. */
  onRemoveVersion?: (alternativeId: string) => void;
}

const BY_NAME: ITableSort = { columnId: "name", direction: "ascending" };

const betaTable = (state: IState) => state.settings.mods?.betaTable === true;

const NO_ROW_ACTIONS: ITableRowAction[] = [];
const NO_ALTERNATIVES: { [modId: string]: IModWithState[] } = {};
const nop = () => undefined;

/**
 * The Mods page's table: the classic one, or the new one while the user has the beta view on.
 *
 * The new table is asked to show a group; see useModsTableFocusRequest.
 */
export const ModsTableSwitch = ({
  mods,
  legacy,
  onSetModsEnabled,
  rowActions = NO_ROW_ACTIONS,
  alternatives = NO_ALTERNATIVES,
  onSelectVersion = nop,
  onRemoveVersion,
}: IModsTableSwitchProps) => {
  const { t } = useTranslation(["common"]);
  const newTable = useSelector(betaTable);

  const {
    views,
    view,
    grouping,
    groupingLocked,
    isColumnShown,
    canReset,
    select: selectView,
    setGrouping,
    setColumnVisible,
    reset: resetView,
    addView,
    renameView,
    removeView,
  } = useModsTableView(mods);
  const [quickFilter, setQuickFilter] = useState<ModsQuickFilter>("all");
  const conflicts = useSelector(
    (state: IState) =>
      (state.session as { dependencies?: { conflicts?: Record<string, unknown[]> } }).dependencies
        ?.conflicts,
  );
  const memberships = useCollectionMemberships(mods);
  const { changing, setEnabled, isEnabled } = useModsEnabled(onSetModsEnabled);

  // mORTEX : les filtres segmentés de la barre d'outils (Tous, Activés, Conflits, Mises à jour)
  const shownMods = useMemo(() => {
    if (quickFilter === "all") {
      return mods;
    }

    const keep = (mod: IModWithState) => {
      if (quickFilter === "enabled") {
        return isEnabled(mod);
      }
      if (quickFilter === "conflicts") {
        return (conflicts?.[mod.id]?.length ?? 0) > 0;
      }
      return modHasUpdate(mod);
    };

    return Object.fromEntries(Object.entries(mods).filter(([, mod]) => keep(mod)));
  }, [mods, quickFilter, conflicts, isEnabled]);
  const rows = useMemo(() => allModRows(shownMods), [shownMods]);

  const enableInstalled = useCallback((ids: string[]) => setEnabled(ids, true), [setEnabled]);
  const installMods = useInstallMods(enableInstalled);
  const install = useCallback((modId: string) => void installMods([modId]), [installMods]);

  const {
    setGroupEnabled,
    pending: pendingDisable,
    disablePending,
    cancelPending,
  } = useGroupEnabled(memberships, setEnabled);

  const dataColumns = useModsTableDataColumns(memberships);

  const { actionsFor, pinnedCount } = useModRowActions(rowActions);

  // mORTEX : la fiche du mod double-cliqué, à droite de la liste, comme dans l'ancienne interface
  const [inspectedId, setInspectedId] = useState<string>();
  const inspected =
    inspectedId === undefined ? undefined : rows.find(({ mod }) => mod.id === inspectedId);
  const closeInspector = useCallback(() => setInspectedId(undefined), []);
  const inspectedAction = (title: string) => {
    const action = inspected && actionsFor(inspected.mod.id).find(({ id }) => id === title);
    return action?.onClick !== undefined && !action.disabled ? action.onClick : undefined;
  };
  // Une archive importée (sans données de téléchargement Nexus) garde ses identifiants dans
  // ses attributs : la fiche ouvre alors la page elle-même, par l'événement de Vortex.
  const extensions = React.useContext(ExtensionContext);
  const gameMode = useSelector(activeGameId);
  const openNexus = (() => {
    const viaAction = inspectedAction("Open on Nexus Mods");
    const attributes = inspected?.mod.attributes;
    if (
      viaAction !== undefined ||
      attributes?.source !== "nexus" ||
      attributes.modId === undefined
    ) {
      return viaAction;
    }
    return () =>
      extensions
        ?.getApi()
        .events.emit(
          "open-mod-page",
          attributes.downloadGame ?? gameMode,
          attributes.modId,
          "nexus",
        );
  })();
  const analytics = useModsTableAnalytics();
  const rowTracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.row);
  const selectionTracking = useToolbarAnalytics(MODS_TABLE_TOOLBARS.selection);
  const groupTracking = useToolbarAnalytics(modsTableGroupToolbar(grouping));

  const collectionActions = useCollectionGroupActions(actionsFor);

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // Those still listed, as a removed mod can't be acted on.
  const selectedIds = useMemo(
    () => [...selected].filter((id) => mods[id] !== undefined),
    [mods, selected],
  );
  const selectionActions = useModSelectionActions(rowActions, selectedIds);
  const selectedEnabled = selectedIds.filter((id) => isEnabled(mods[id])).length;

  // A row's actions are for its own mod, which would read as for every selected one.
  const multiSelected = selectedIds.length > 1;
  const shownPins = multiSelected ? 0 : pinnedCount;

  const columns = useMemo<IModsTableColumn[]>(
    () => [
      // mORTEX : l'interrupteur en première colonne, comme sur les maquettes
      {
        id: "mortex-enabled",
        header: t("Enabled"),
        width: "72px",
        cell: ({ mod, name }) => (
          <ModRowToggle
            enabled={isEnabled(mod)}
            installLabel={t("Install {{name}}", { name })}
            isLoading={changing.has(mod.id)}
            label={t("{{name}} enabled", { name })}
            modId={mod.id}
            modState={mod.state}
            onInstall={mod.state === "downloaded" ? install : undefined}
            onSetEnabled={setEnabled}
          />
        ),
        // Part on while only some of its mods are, as after keeping the shared ones.
        groupCell: (group) => {
          const enabled = group.rows.filter(({ mod }) => isEnabled(mod)).length;

          return (
            <Switch
              aria-label={t("{{name}} enabled", { name: group.label })}
              checked={group.rows.length > 0 && enabled === group.rows.length}
              indeterminate={enabled > 0 && enabled < group.rows.length}
              isLoading={group.rows.some(({ mod }) => changing.has(mod.id))}
              onChange={(checked) => setGroupEnabled(group, checked)}
            />
          );
        },
      },
      {
        id: "name",
        header: t("Name"),
        sort: (a, b) => a.name.localeCompare(b.name),
        searchText: ({ name }) => name,
        cell: ({ mod, name }) => (
          <>
            <ModHoverCard className="ml-2 h-5 rounded-sm" mod={mod} name={name} />

            <span className="ml-2 truncate">{name}</span>
          </>
        ),
        groupCell: ({ avatar, collection, label, rows }) => (
          <>
            {!!avatar && (
              <Image
                alt=""
                className="ml-3.5 h-6 rounded-full"
                fallbackIcon={{ name: "person", filled: true }}
                fit="cover"
                imageType="avatar"
                src={avatar.src}
              />
            )}

            {!!collection && (
              <CollectionHoverCard className="ml-3 h-8 rounded-xs" collection={collection} />
            )}

            <span className="ml-2 truncate">{label}</span>

            <span className="ml-2 font-normal text-translucent-moderate">{rows.length}</span>
          </>
        ),
      },
      {
        id: "status",
        header: t("Actions"),
        groupLabel: t("Status"),
        width: actionsWidth(0),
        revealWidth: shownPins ? `${PINNED_ACTION_WIDTH * shownPins}px` : undefined,
        sticky: "end",
        groupBy: ({ mod }) => {
          if (mod.state === "downloaded") {
            return mod.attributes?.wasInstalled ? t("Uninstalled") : t("Never installed");
          }
          if (mod.state === "installing") {
            return t("Installing");
          }
          return isEnabled(mod) ? t("Enabled") : t("Disabled");
        },
        groupOrder: [
          t("Never installed"),
          t("Uninstalled"),
          t("Installing"),
          t("Enabled"),
          t("Disabled"),
        ],
        cell: ({ mod, name }) => (
          <ModRowActions
            actions={actionsFor(mod.id)}
            enabled={isEnabled(mod)}
            installLabel={t("Install {{name}}", { name })}
            isLoading={changing.has(mod.id)}
            label={t("{{name}} enabled", { name })}
            modId={mod.id}
            modState={mod.state}
            switchOnly={multiSelected}
            width={actionsWidth(shownPins)}
            onInstall={mod.state === "downloaded" ? install : undefined}
            showToggle={false}
            onSetEnabled={setEnabled}
          />
        ),
      },
      // The legacy table's, sharing its choice to show it and its place.
      {
        id: "version",
        header: t("Version"),
        // mORTEX : assez large pour « 1.2 (Nom d'une collection) » sans le tronquer
        width: "280px",
        isToggleable: true,
        position: 40,
        searchText: ({ mod }) => modVersionText(mod, alternatives[mod.id], t),
        groupBy: ({ mod }) => modVersionGroup(mod, t),
        groupOrder: [t("Update available"), t("Up-to-date")],
        cell: ({ mod }) => (
          <ModVersion
            alternatives={alternatives[mod.id]}
            mod={mod}
            onRemove={onRemoveVersion}
            onSelect={onSelectVersion}
          />
        ),
        // A collection's group shows its revision, as the collection's own row does.
        groupCell: ({ collection }) =>
          collection === undefined ? null : <CollectionRevision collection={collection} />,
      },
      // mORTEX : l'état du mod en pastille (à jour, mise à jour, non installé)
      {
        id: "mortex-status",
        header: t("Mod status"),
        width: "140px",
        isToggleable: true,
        position: 45,
        searchText: ({ mod }) => modStatusKind(mod),
        cell: ({ mod }) => <ModStatusPill mod={mod} />,
      },
      ...dataColumns,
    ],
    [
      actionsFor,
      alternatives,
      changing,
      dataColumns,
      install,
      isEnabled,
      multiSelected,
      onRemoveVersion,
      onSelectVersion,
      setEnabled,
      setGroupEnabled,
      shownPins,
      t,
    ],
  );

  const { visibleColumns, toggles, groupable } = useModsTableColumns(columns, isColumnShown);

  const groups = useModsTableGroups(shownMods, grouping, groupable, memberships, t);

  const { search, setSearch, changeSearch, isSearching, shownRows, shownGroups } =
    useModsTableSearch({
      rows,
      groups,
      visibleColumns,
      selected,
      setSelected,
      onSearchStarted: analytics.onSearchStarted,
    });

  const { focusGroupId, onGroupFocused } = useModsTableFocusRequest({ groups, search, setSearch });

  const displayOptions = useDisplayOptionsAction({
    label: t("View options"),
    canReset,
    children: (
      <>
        <ModsTableGroupBy
          columns={groupable}
          disabled={groupingLocked}
          grouping={grouping}
          onChange={setGrouping}
        />

        <ModsTableColumnToggles toggles={toggles} onToggle={setColumnVisible} />
      </>
    ),
    onReset: resetView,
  });

  if (!newTable) {
    return <>{legacy}</>;
  }

  const footer = multiSelected && (
    <TableSelectionBar count={selectedIds.length} onClear={() => setSelected(new Set())}>
      <Toolbar
        className="min-w-0 flex-1 justify-end"
        pinningId={MOD_SELECTION_PINNING_ID}
        tracking={selectionTracking}
      >
        {/* Always on the bar, ahead of the menu: the one action that can't be unpinned. */}
        <ToolbarGroup
          actions={selectionActions}
          beforeOverflow={
            <Switch
              aria-label={t("Selected mods enabled")}
              checked={selectedEnabled === selectedIds.length}
              indeterminate={selectedEnabled > 0 && selectedEnabled < selectedIds.length}
              isLoading={selectedIds.some((id) => changing.has(id))}
              onChange={(checked) => setEnabled(selectedIds, checked)}
            />
          }
        />
      </Toolbar>
    </TableSelectionBar>
  );

  const tableProps = {
    onRowDoubleClick: ({ mod }: IModRow) => setInspectedId(mod.id),
    // mORTEX : par catégorie, la liste s'ouvre repliée ; une recherche montre ses résultats ouverts
    collapsedByDefault: grouping === "category" && !isSearching,
    focusGroupId,
    onGroupFocused,
    className: "mb-2 flex-1",
    toolbar: (
      <ModsTableToolbar
        displayOptions={displayOptions}
        quickFilter={quickFilter}
        search={search}
        selectedView={view.id}
        views={views}
        onAddView={addView}
        onQuickFilterChange={setQuickFilter}
        onRemoveView={removeView}
        onRenameView={renameView}
        onSearchChange={changeSearch}
        onSelectView={selectView}
      />
    ),
    columns: visibleColumns,
    getRowId: ({ mod }: IModRow) => mod.id,
    label: t("Mods"),
    selectable: true,
    getRowLabel: ({ name }: IModRow) => name,
    selectedIds: selected,
    onSelectedIdsChange: setSelected,
    rowMenu: ({ mod, name }: IModRow, close: () => void) =>
      multiSelected ? (
        <>
          <DropdownBlock>
            <Typography appearance="subdued" typographyType="body-sm">
              {t("{{count}} items selected", { count: selectedIds.length })}
            </Typography>
          </DropdownBlock>

          <DropdownDivider />

          <ToolbarMenu
            actions={selectionActions}
            label={t("Selected mods actions")}
            tracking={selectionTracking}
            onSelect={close}
          />
        </>
      ) : (
        <ToolbarMenu
          actions={actionsFor(mod.id)}
          label={t("{{name}} actions", { name })}
          pinningId={MOD_ROW_PINNING_ID}
          pinTarget="row"
          tracking={rowTracking}
          onSelect={close}
        />
      ),
    groupMenu: ({ collection }: IModGroup) => {
      if (!collection) {
        return [];
      }
      return collectionActions(collection);
    },
    groupTracking,
    onMenuOpen: analytics.onMenuOpen,
    defaultSort: BY_NAME,
    footer,
    empty: isSearching && <NoResults icon="search" title={t("No mods match your search")} />,
  };

  // A table takes rows or groups, never both; typed, so neither gains the other as undefined.
  const data: { groups: IModGroup[] } | { rows: IModRow[] } = shownGroups
    ? { groups: shownGroups }
    : { rows: shownRows };

  return (
    <>
      {/* Toujours enveloppé : ouvrir la fiche ne remonte pas le tableau (groupes, défilement) */}
      <div className="mortex-mods-body">
        <Table {...tableProps} {...data} />

        {inspected !== undefined && (
          <ModInspector
            key={inspected.mod.id}
            mod={inspected.mod}
            name={inspected.name}
            onClose={closeInspector}
            onOpenConflicts={inspectedAction("Manage File Conflicts")}
            onOpenFolder={inspectedAction("Open in File Manager")}
            onOpenNexus={openNexus}
          />
        )}
      </div>

      <DisableSharedModsModal
        collections={pendingDisable?.shared.collections ?? []}
        isOpen={pendingDisable !== undefined}
        sharedCount={pendingDisable?.shared.rows.length ?? 0}
        onClose={cancelPending}
        onDisableAll={() => disablePending(false)}
        onKeepShared={() => disablePending(true)}
      />
    </>
  );
};
