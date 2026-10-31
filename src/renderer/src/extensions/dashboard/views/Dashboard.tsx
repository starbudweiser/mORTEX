import * as React from "react";
import { Button, MenuItem } from "react-bootstrap";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import { ComponentEx, connect, translate } from "../../../controls/ComponentEx";
import DropdownButton from "../../../controls/DropdownButton";
import FlexLayout from "../../../controls/FlexLayout";
import Icon from "../../../controls/Icon";
import { IconButton } from "../../../controls/TooltipControls";
import type { IDashletSettings, IState } from "../../../types/IState";
import { getWindowId } from "../../../util/preloadAccess";
import { getSafe } from "../../../util/storeHelper";
import MainPage from "../../../views/MainPage";
import { setDashboardGrid, setDashletEnabled } from "../actions";
import type { RectMap } from "../gridLayout";
import { layoutAll, LEGACY_H, LEGACY_W } from "../gridLayout";
import type { IDashletProps } from "../types/IDashletProps";
import DashboardGrid from "./DashboardGrid";
import FixedItem from "./FixedItem";

const UPDATE_FREQUENCY_MS = 1000;

interface IBaseProps {
  active: boolean;
  dashlets: IDashletProps[];
}

interface IConnectedProps {
  layout: string[];
  grid: RectMap;
  dashletSettings: { [dashletId: string]: IDashletSettings };
  // Per-dashlet visibility keyed by dash.title. Computed in mapStateToProps
  // so any state slice an isVisible() callback reads becomes part of
  // Dashboard's redux subscription (without enumerating slices). Reference
  // is stable when no visibility changed.
  dashletVisible: Readonly<Record<string, boolean>>;
}

interface IActionProps {
  onSetDashletEnabled: (dashletId: string, enabled: boolean) => void;
  onSetGrid: (grid: RectMap) => void;
}

type IProps = IBaseProps & IConnectedProps & IActionProps;

interface IComponentState {
  counter: number;
  editMode: boolean;
}

/**
 * base layouter for the dashboard. No own content, just layouting
 */
class Dashboard extends ComponentEx<IProps, IComponentState> {
  private mUpdateTimer: NodeJS.Timeout;
  private mWindowFocused: boolean = true;
  private mUnsubscribeFocus: (() => void) | undefined;
  private mUnsubscribeBlur: (() => void) | undefined;

  constructor(props: IProps) {
    super(props);

    this.initState({
      counter: 0,
      editMode: false,
    });
  }

  public componentDidMount() {
    this.startUpdateCycle();
    // Check initial focus state
    window.api.window.isFocused(getWindowId()).then((focused) => {
      this.mWindowFocused = focused;
    });
    // Subscribe to focus/blur events via preload API
    this.mUnsubscribeFocus = window.api.window.onFocus(this.onFocus);
    this.mUnsubscribeBlur = window.api.window.onBlur(this.onBlur);
  }

  public componentWillUnmount() {
    clearTimeout(this.mUpdateTimer);
    // Unsubscribe from focus/blur events
    this.mUnsubscribeFocus?.();
    this.mUnsubscribeBlur?.();
  }

  public UNSAFE_componentWillReceiveProps(nextProps: IProps) {
    if (this.props.active !== nextProps.active) {
      if (nextProps.active && this.mUpdateTimer === undefined) {
        this.startUpdateCycle();
      } else if (!nextProps.active && this.mUpdateTimer !== undefined) {
        clearTimeout(this.mUpdateTimer);
        this.mUpdateTimer = undefined;
      }
    }
  }

  public render(): JSX.Element {
    const { dashletSettings, dashletVisible, layout, dashlets, grid } = this.props;
    const { editMode } = this.state;

    const layoutMap: { [key: string]: number } = layout.reduce((prev, key, idx) => {
      prev[key] = idx + 1;
      return prev;
    }, {});

    // Dashlets not in the layout (e.g. just re-enabled) are appended after
    // all existing items so Packery places them in the first available gap
    // instead of overlapping with items that already claimed their old position.
    const layoutSize = layout.length;

    const sorted = dashlets
      .filter(
        (dash: IDashletProps) =>
          dashletVisible[dash.title] &&
          (!dash.closable || getSafe(dashletSettings, [dash.title, "enabled"], true)),
      )
      .sort(
        (lhs: IDashletProps, rhs: IDashletProps) =>
          (layoutMap[lhs.title] ?? layoutSize + lhs.position) -
          (layoutMap[rhs.title] ?? layoutSize + rhs.position),
      );
    const { fixed, dynamic } = sorted.reduce(
      (prev, dash) => {
        const isFixed = getSafe(dashletSettings, [dash.title, "fixed"], dash.fixed);
        prev[isFixed ? "fixed" : "dynamic"].push(dash);
        return prev;
      },
      { fixed: [], dynamic: [] },
    );

    const rects = layoutAll(
      dynamic.map((dash) => ({
        id: dash.title,
        defaultSize: {
          w: (dashletSettings?.[dash.title]?.width ?? dash.width) * LEGACY_W,
          h: (dashletSettings?.[dash.title]?.height ?? dash.height) * LEGACY_H,
        },
      })),
      grid ?? {},
    );

    const classes = ["page-dashboard", editMode ? "dashboard-edit" : "dashboard-view"];

    return (
      <MainPage id="page-dashboard" className={classes.join(" ")}>
        <MainPage.Body style={{ display: "flex", flexDirection: "column" }}>
          <div className="dashboard-editbar">{this.renderEditBar()}</div>
          <div className="fixed-dashlets">{fixed.map(this.renderFixedItem)}</div>
          <div className="dynamic-dashlets">
            <DashboardGrid
              items={dynamic.map((dash) => ({
                id: dash.title,
                closable: dash.closable !== false,
                content: this.renderContent(dash),
              }))}
              rects={rects}
              editMode={editMode}
              onCommit={this.onCommitGrid}
              onDismiss={this.dismissDashlet}
            />
          </div>
        </MainPage.Body>
      </MainPage>
    );
  }

  private renderEditBar() {
    const { t, dashlets, dashletSettings, dashletVisible } = this.props;
    const { editMode } = this.state;

    return editMode ? (
      <FlexLayout type="row">
        <FlexLayout.Fixed>
          {t("Drag dashlets to rearrange and drag the borders to resize")}
        </FlexLayout.Fixed>
        <FlexLayout.Flex />
        <FlexLayout.Fixed>
          <DropdownButton id="add-widget-button" title={t("Add Dashlet")}>
            {dashlets
              .filter((dash) => dash.closable && dashletVisible[dash.title])
              .map((dash) => (
                <MenuItem onClick={this.toggleMenuItem} data-id={dash.title} key={dash.title}>
                  <Icon
                    name={
                      dashletSettings[dash.title]?.enabled === false
                        ? "checkbox-unchecked"
                        : "checkbox-checked"
                    }
                  />{" "}
                  {dash.title}
                </MenuItem>
              ))}
          </DropdownButton>
          <Button onClick={this.toggleEdit}>{t("Done")}</Button>
        </FlexLayout.Fixed>
      </FlexLayout>
    ) : (
      <div className="dashlet-customize-btn">
        <IconButton icon="edit" tooltip={t("Customize your dashboard")} onClick={this.toggleEdit}>
          {t("Customize your dashboard")}
        </IconButton>
      </div>
    );
  }

  private toggleMenuItem = (evt: React.MouseEvent<any>) => {
    evt.stopPropagation();
    const { dashletSettings } = this.props;
    const dashId = evt.currentTarget.getAttribute("data-id");
    const old = dashletSettings[dashId]?.enabled !== false;
    this.props.onSetDashletEnabled(dashId, !old);
  };

  private toggleEdit = () => {
    this.nextState.editMode = !this.nextState.editMode;
  };

  private onFocus = () => {
    this.mWindowFocused = true;
  };

  private onBlur = () => {
    this.mWindowFocused = false;
  };

  private startUpdateCycle = () => {
    // TODO: this is a hack needed so dashlets get updated even if they get props passed in
    //   in a way that doesn't properly signal for an update.
    //   it should be possible to make this unnecessary with makeReactive, but that requires
    //   testing

    this.mUpdateTimer = setTimeout(() => {
      if (this.mWindowFocused && process.env["DEBUG_REACT_RENDERS"] !== "true") {
        this.nextState.counter++;
      }
      this.startUpdateCycle();
    }, UPDATE_FREQUENCY_MS);
  };

  private renderFixedItem = (dash: IDashletProps) => {
    const { t } = this.props;
    const { counter, editMode } = this.state;
    const componentProps = dash.props !== undefined ? dash.props() : {};

    return (
      <FixedItem
        t={t}
        id={dash.title}
        key={dash.title}
        width={dash.width}
        height={dash.height}
        editable={editMode}
        onDismiss={dash.closable ? this.dismissDashlet : undefined}
      >
        <dash.component t={this.props.t} {...componentProps} counter={counter} />
      </FixedItem>
    );
  };

  private renderContent = (dash: IDashletProps) => {
    const { counter } = this.state;
    const componentProps = dash.props !== undefined ? dash.props() : {};
    return <dash.component t={this.props.t} {...componentProps} counter={counter} />;
  };

  private onCommitGrid = (rects: RectMap) => {
    this.props.onSetGrid({ ...this.props.grid, ...rects });
  };

  private dismissDashlet = (dashletId: string) => {
    this.props.onSetDashletEnabled(dashletId, false);
  };
}

// Factory pattern so each Dashboard instance gets its own memo for the
// visibility record. Without memoization the object reference would change
// on every dispatch and defeat react-redux's shallow comparison, causing a
// re-render on every action.
const EMPTY_GRID: RectMap = {};

function makeMapStateToProps(): (state: IState, ownProps: IBaseProps) => IConnectedProps {
  let lastDashlets: IDashletProps[] | undefined;
  let lastKey: string | undefined;
  let lastVisible: Readonly<Record<string, boolean>> = {};
  return (state, ownProps) => {
    const visible: Record<string, boolean> = {};
    let key = "";
    for (const dash of ownProps.dashlets) {
      const v = dash.isVisible?.(state) !== false;
      visible[dash.title] = v;
      key += v ? "1" : "0";
    }
    // Rebuild when the dashlet set itself changed (registration) or any
    // visibility flipped. Comparing dashlets by reference catches reorders
    // and add/remove even when the value row happens to encode the same.
    if (ownProps.dashlets !== lastDashlets || key !== lastKey) {
      lastDashlets = ownProps.dashlets;
      lastKey = key;
      lastVisible = visible;
    }
    return {
      // Defensive checks: interface might not be initialized during hydration
      layout: state.settings?.interface?.dashboardLayout ?? [],
      grid: state.settings?.interface?.dashboardGrid ?? EMPTY_GRID,
      dashletSettings: state.settings?.interface?.dashletSettings ?? {},
      dashletVisible: lastVisible,
    };
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetDashletEnabled: (dashletId: string, enabled: boolean) =>
      dispatch(setDashletEnabled(dashletId, enabled)),
    onSetGrid: (grid: RectMap) => dispatch(setDashboardGrid(grid)),
  };
}

export default translate(["common"])(
  connect(makeMapStateToProps, mapDispatchToProps)(Dashboard),
) as React.ComponentClass<{}>;
