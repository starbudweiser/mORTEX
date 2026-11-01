import path from "path";
import { pathToFileURL } from "url";

import type { TFunction } from "i18next";
import update from "immutability-helper";
import * as _ from "lodash";
import * as React from "react";
import { Button, Checkbox, ControlLabel, Form, FormGroup, Radio } from "react-bootstrap";

import { connect, PureComponentEx, translate } from "../../../controls/ComponentEx";
import Modal from "../../../controls/Modal";
import Spinner from "../../../controls/Spinner";
import { IconButton } from "../../../controls/TooltipControls";
import ZoomableImage from "../../../controls/ZoomableImage";
import type { IState } from "../../../types/api";
import { pushSafe, removeValue } from "../../../util/storeHelper";
import { truthy } from "../../../util/util";
import type {
  GroupType,
  IGroup,
  IInstallerInfo,
  IInstallerState,
  IInstallStep,
  IPlugin,
  OrderType,
} from "../types/interface";
import { hasSessionFOMOD } from "../utils/guards";

interface IGroupProps {
  t: TFunction;
  disabled: boolean;
  stepId: number;
  group: IGroup;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: (
    image: string | undefined,
    description: string | undefined,
    name?: string,
  ) => void;
}

interface IGroupState {
  selectedPlugins: number[];
  // localUpdate stores when the last local update has been made. This is used
  // to prevent top-down updates from undoing them if the remote process takes
  // long to reply
  localUpdate: number;
  sentUpdate: number;
  confirmedUpdate: number;
}

const nop = () => undefined;

class Group extends React.PureComponent<IGroupProps, IGroupState> {
  private mValidate: (selected: number[]) => string | undefined = (selected: number[]) => undefined;
  constructor(props: IGroupProps) {
    super(props);
    this.state = {
      selectedPlugins: this.getSelectedPlugins(props),
      localUpdate: 0,
      sentUpdate: 0,
      confirmedUpdate: 1,
    };
  }

  public componentDidUpdate(oldProps: IGroupProps, oldState: IGroupState) {
    const { group, onSelect } = this.props;
    const { confirmedUpdate, localUpdate, sentUpdate, selectedPlugins } = this.state;
    const valid = this.validateFunc(group.type)(selectedPlugins);
    if (
      selectedPlugins !== oldState.selectedPlugins &&
      localUpdate > sentUpdate &&
      // if the confirmation is still pending, don't send now
      confirmedUpdate >= sentUpdate
    ) {
      onSelect(group.id, selectedPlugins, valid === undefined);
      this.setState(update(this.state, { sentUpdate: { $set: Date.now() } }));
    }

    if (!_.isEqual(oldProps.group, this.props.group)) {
      // based on the rules of the fomod, us selecting an option may make other options
      // unavailable. However, for usability reasons, we don't undo user selections if the user
      // has made further changes since last sending an update
      if (this.state.sentUpdate >= this.state.localUpdate) {
        this.setState(
          update(this.state, {
            selectedPlugins: { $set: this.getSelectedPlugins(this.props) },
            confirmedUpdate: { $set: Date.now() },
          }),
        );
      } else if (this.state.localUpdate > this.state.sentUpdate) {
        // while confirmation was pending, the user made further changes, validate them now
        const { group, onSelect } = this.props;
        const { selectedPlugins } = this.state;
        const valid = this.validateFunc(group.type)(selectedPlugins);
        onSelect(group.id, selectedPlugins, valid === undefined);
        this.setState(update(this.state, { sentUpdate: { $set: Date.now() } }));
      }
      this.mValidate = this.validateFunc(this.props.group.type);
    }
  }

  public componentDidMount() {
    const { group, onSelect } = this.props;
    const { selectedPlugins } = this.state;
    this.mValidate = this.validateFunc(group.type);
    if (this.mValidate(selectedPlugins) !== undefined) {
      onSelect(group.id, selectedPlugins, false);
    }
  }

  public render(): JSX.Element {
    const { t, disabled, group } = this.props;
    const { selectedPlugins } = this.state;

    const validationMessage = this.mValidate(selectedPlugins);
    const validationState = validationMessage === undefined ? null : "error";

    return (
      <FormGroup disabled={disabled} validationState={validationState}>
        <ControlLabel>
          <span>{group?.name ?? `<${t("Missing group name")}>`}</span>

          <span className="fomod-group-rule">{validationMessage ?? this.ruleText(group.type)}</span>
        </ControlLabel>

        <div className="fomod-options">
          {this.renderNoneOption()}
          {group.options.map(this.renderPlugin)}
        </div>
      </FormGroup>
    );
  }

  private ruleText(type: GroupType): string {
    const { t } = this.props;
    switch (type) {
      case "SelectAtLeastOne":
        return t("At least one option");
      case "SelectAtMostOne":
        return t("One option at most");
      case "SelectExactlyOne":
        return t("One option only");
      case "SelectAll":
        return t("All included");
      default:
        return t("Several options possible");
    }
  }

  private getSelectedPlugins(props: IGroupProps) {
    return props.group.options.filter((plugin) => plugin.selected).map((plugin) => plugin.id);
  }

  private validateFunc(type: GroupType): (selected: number[]) => string | undefined {
    const { t } = this.props;
    switch (type) {
      case "SelectAtLeastOne":
        return (selected: number[]) =>
          selected.length === 0 ? t("Select at least one") : undefined;
      case "SelectAtMostOne":
        return (selected: number[]) => (selected.length > 1 ? t("Select at most one") : undefined);
      case "SelectExactlyOne":
        return (selected: number[]) =>
          selected.length !== 1 ? t("Select exactly one") : undefined;
      default:
        return () => undefined;
    }
  }

  private renderNoneOption = (): JSX.Element | null => {
    const { t, disabled, group, stepId } = this.props;
    const { selectedPlugins } = this.state;

    if (group.type !== "SelectAtMostOne") {
      return null;
    }

    const isSelected = selectedPlugins.length === 0;
    return (
      <Radio
        id={`radio-${stepId}-${group.id}-none`}
        key="none"
        disabled={disabled}
        name={group.id.toString()}
        data-value="none"
        checked={isSelected}
        onChange={this.select}
      >
        {t("None")}
      </Radio>
    );
  };

  private renderPlugin = (plugin: IPlugin): JSX.Element => {
    const { t, disabled, group, stepId } = this.props;
    const { selectedPlugins } = this.state;

    const isSelected = selectedPlugins.includes(plugin.id);
    const id = `${stepId}-${group.id}-${plugin.id}`;
    const readOnly = plugin.type === "Required";

    const content = (
      <a className="fake-link" data-value={plugin.id} onMouseOver={this.showDescription}>
        {plugin.name}
        {plugin.preset ? ` (${t("Preset")})` : ""}
      </a>
    );
    switch (group.type) {
      case "SelectExactlyOne":
      case "SelectAtMostOne":
        return (
          <Radio
            id={"radio-" + id}
            key={plugin.id}
            data-value={plugin.id}
            name={group.id.toString()}
            checked={isSelected}
            onChange={readOnly ? nop : this.select}
            disabled={disabled || plugin.type === "NotUsable"}
            title={plugin.conditionMsg}
          >
            {content}
          </Radio>
        );
      case "SelectAll":
        return (
          <Checkbox
            id={"checkbox-" + id}
            key={plugin.id}
            checked={isSelected}
            data-value={plugin.id}
            disabled={true}
          >
            {content}
          </Checkbox>
        );
      default:
        return (
          <Checkbox
            id={"checkbox-" + id}
            key={plugin.id}
            data-value={plugin.id}
            checked={isSelected}
            disabled={disabled || plugin.type === "NotUsable"}
            onChange={readOnly ? nop : this.select}
            title={plugin.conditionMsg}
          >
            {content}
          </Checkbox>
        );
    }
  };

  private showDescription = (evt: React.FormEvent<any>) => {
    const { group, onShowDescription } = this.props;

    const pluginId = parseInt(evt.currentTarget.getAttribute("data-value"), 10);
    const { image, description, name } = group.options[pluginId];

    onShowDescription(image, description, name);
  };

  private select = (evt: React.FormEvent<any>) => {
    const { group, onShowDescription } = this.props;

    const value = evt.currentTarget.getAttribute("data-value");
    if (value === "none") {
      this.setState(
        update(this.state, {
          selectedPlugins: { $set: [] },
          localUpdate: { $set: Date.now() },
        }),
      );
      onShowDescription(undefined, undefined);
      return;
    }

    const pluginId = parseInt(value, 10);

    this.showDescription(evt);

    if (["SelectExactlyOne", "SelectAtMostOne"].indexOf(group.type) !== -1) {
      this.setState(
        update(this.state, {
          selectedPlugins: { $set: [pluginId] },
          localUpdate: { $set: Date.now() },
        }),
      );
    } else if (this.state.selectedPlugins.indexOf(pluginId) === -1) {
      this.setState(
        update(this.state, {
          selectedPlugins: {
            $set: Array<number>().concat(this.state.selectedPlugins, [pluginId]),
          },
          localUpdate: { $set: Date.now() },
        }),
      );
    } else {
      this.setState(
        update(this.state, {
          selectedPlugins: {
            $set: this.state.selectedPlugins.filter((iter) => iter !== pluginId),
          },
          localUpdate: { $set: Date.now() },
        }),
      );
    }
  };
}

function getGroupSortFunc(order: OrderType) {
  if (order === "AlphaDesc") {
    return (lhs: IGroup, rhs: IGroup) => rhs.name.localeCompare(lhs.name);
  } else {
    return (lhs: IGroup, rhs: IGroup) => lhs.name.localeCompare(rhs.name);
  }
}

interface IStepProps {
  t: TFunction;
  step: IInstallStep;
  onSelect: (groupId: number, plugins: number[], valid: boolean) => void;
  onShowDescription: IGroupProps["onShowDescription"];
  disabled: boolean;
}

function Step(props: IStepProps) {
  let groupsSorted: IGroup[];
  if (props.step.optionalFileGroups?.group === undefined) {
    return null;
  }
  if (props.step.optionalFileGroups.order === "Explicit") {
    groupsSorted = props.step.optionalFileGroups.group;
  } else {
    const sortFunc = getGroupSortFunc(props.step.optionalFileGroups.order);
    groupsSorted = props.step.optionalFileGroups.group.slice(0).sort(sortFunc);
  }

  return (
    <Form disabled={props.disabled} id="fomod-installer-form">
      {groupsSorted.map((group: IGroup) => (
        <Group
          t={props.t}
          disabled={props.disabled}
          key={`${props.step.id}-${group.id}`}
          stepId={props.step.id}
          group={group}
          onSelect={props.onSelect}
          onShowDescription={props.onShowDescription}
        />
      ))}
    </Form>
  );
}

interface IConnectedProps {
  installerInfo: IInstallerInfo | undefined;
  installerState: IInstallerState | undefined;
  activeInstanceId: string | undefined;
}

interface IDialogState {
  invalidGroups: string[];
  currentImage: string | undefined;
  currentDescription: string | undefined;
  currentName: string | undefined;
  waiting: boolean;
}

type IProps = IConnectedProps;

class InstallerDialog extends PureComponentEx<IProps, IDialogState> {
  constructor(props: IProps) {
    super(props);
    this.state = this.initDescription(props);
  }

  public componentDidUpdate(prevProps: IProps) {
    if (
      // when initiating the dialog
      (prevProps.installerState === undefined && this.props.installerState !== undefined) ||
      // and any time we change to a different page (forward or backwards)
      (prevProps.installerState !== undefined &&
        this.props.installerState !== undefined &&
        (prevProps.installerInfo !== this.props.installerInfo ||
          prevProps.installerState.currentStep !== this.props.installerState.currentStep))
    ) {
      // fully update the description
      this.setState(this.initDescription(this.props));
    }
  }

  public render(): JSX.Element | null {
    const { t, installerInfo, installerState, activeInstanceId } = this.props;
    const { currentDescription, currentName, waiting } = this.state;

    if (!truthy(installerState)) {
      return null;
    }

    // Use default values if installerInfo is missing
    const moduleName = installerInfo?.moduleName || "FOMOD Installer";
    const idx = installerState.currentStep;
    const steps = installerState.installSteps;
    const nextVisible = steps.find((step: IInstallStep, i: number) => i > idx && step.visible);
    let lastVisible: IInstallStep | undefined;
    steps.forEach((step: IInstallStep, i: number) => {
      if (i < idx && step.visible) {
        lastVisible = step;
      }
    });
    const nextDisabled = this.state.invalidGroups.length > 0;
    const chosen = (steps[idx].optionalFileGroups?.group ?? []).reduce(
      (sum, group) => sum + group.options.filter((option) => option.selected).length,
      0,
    );
    return (
      <Modal
        id="fomod-installer-dialog"
        show={activeInstanceId != null}
        onHide={this.cancel}
        backdrop="static"
      >
        <Modal.Header>
          <Modal.Title>{moduleName}</Modal.Title>
          <span className="fomod-step-name">{steps[idx].name}</span>
          <IconButton
            id="fomod-cancel"
            className="close-button"
            tooltip={t!("Cancel")}
            icon="close"
            onClick={this.cancel}
          />
          <div aria-hidden="true" className="fomod-progress">
            <span style={{ transform: `scaleX(${(idx + 1) / steps.length})` }} />
          </div>
        </Modal.Header>
        <Modal.Body>
          <div className="fomod-options-column">
            <Step
              t={t!}
              step={steps[idx]}
              onSelect={this.select}
              onShowDescription={this.showDescription}
              disabled={waiting}
            />
          </div>
          <aside className="fomod-preview">
            {this.renderImage()}
            <div className="fomod-preview-text">
              {currentName && this.hasImage() ? <h4>{currentName}</h4> : null}
              <p>{currentDescription || t!("Hover an option to see its description.")}</p>
            </div>
          </aside>
        </Modal.Body>
        <Modal.Footer>
          <span className="fomod-progress-label">
            {t!("Step {{current}} of {{total}}", {
              replace: { current: idx + 1, total: steps.length },
            })}
            {" · "}
            {chosen === 1
              ? t!("1 option chosen")
              : t!("{{chosen}} options chosen", { replace: { chosen } })}
          </span>
          {lastVisible !== undefined ? (
            <Button onClick={this.prev} disabled={waiting}>
              {waiting ? <Spinner /> : t!("Previous")}
            </Button>
          ) : null}
          <Button className="fomod-primary" disabled={nextDisabled || waiting} onClick={this.next}>
            {waiting ? <Spinner /> : nextVisible !== undefined ? t!("Next") : t!("Finish")}
          </Button>
        </Modal.Footer>
      </Modal>
    );
  }

  private select = (groupId: number, plugins: number[], valid: boolean) => {
    const { events } = this.context.api;
    const { activeInstanceId, installerState } = this.props;

    let newState = this.state;
    newState = valid
      ? removeValue(newState, ["invalidGroups"], groupId)
      : pushSafe(newState, ["invalidGroups"], groupId);

    events.emit(
      `fomod-installer-select-${activeInstanceId}`,
      installerState.installSteps[installerState.currentStep].id,
      groupId,
      plugins,
    );
    this.setState(newState);
  };

  private hasImage(): boolean {
    const { installerInfo } = this.props;
    const image = this.state.currentImage || installerInfo?.image?.path;
    return truthy(installerInfo?.dataPath) && truthy(image);
  }

  private renderImage = () => {
    const { installerInfo } = this.props;
    const { currentImage, currentName } = this.state;

    const image = currentImage || installerInfo?.image?.path;

    if (!truthy(installerInfo?.dataPath) || !truthy(image)) {
      return (
        <div className="fomod-placeholder">
          <svg aria-hidden="true" viewBox="0 0 96 96">
            <circle cx="48" cy="48" fill="none" r="44" stroke="currentColor" strokeWidth="2.5" />
            <path d="M20 48 48 20l28 28-28 28Z" fill="currentColor" opacity="0.8" />
          </svg>
          <h4>{currentName || installerInfo?.moduleName}</h4>
        </div>
      );
    }

    return (
      <ZoomableImage
        // FOMOD scripts are written on Windows ("images\header.png"); split on both separators so
        // the image resolves on macOS and Linux too
        url={pathToFileURL(path.join(installerInfo.dataPath, ...image.split(/[\\/]/))).href}
        className="installer-image"
        overlayClass="installer-zoom"
        container={undefined}
      />
    );
  };

  private initDescription(props: IProps): IDialogState {
    const ret = (option: IPlugin | undefined): IDialogState => ({
      invalidGroups: [],
      currentImage: option?.image,
      currentDescription: option?.description,
      currentName: option?.name,
      waiting: false,
    });

    if (!truthy(props.installerState)) {
      return ret(undefined);
    }
    const { currentStep, installSteps } = props.installerState;

    const selOption = (
      installSteps[currentStep]?.optionalFileGroups?.group?.[0]?.options ?? []
    ).find((opt) => opt.selected);
    return ret(selOption || undefined);
  }

  private showDescription = (
    image: string | undefined,
    description: string | undefined,
    name?: string,
  ) => {
    this.setState(
      update(this.state, {
        currentDescription: { $set: description || "" },
        currentImage: { $set: image || "" },
        currentName: { $set: name || "" },
      }),
    );
  };
  private prev = () => {
    const { events } = this.context.api;
    const { activeInstanceId } = this.props;
    this.setState(
      update(this.state, {
        waiting: { $set: true },
      }),
    );

    // Emit instance-specific event if instanceId is available, otherwise use global event
    events.emit(
      `fomod-installer-continue-${activeInstanceId}`,
      "back",
      this.props.installerState.currentStep,
    );
  };
  private next = () => {
    const { events } = this.context.api;
    const { activeInstanceId, installerState } = this.props;
    this.setState(
      update(this.state, {
        waiting: { $set: true },
      }),
    );

    const idx = installerState.currentStep;
    const steps = installerState.installSteps;
    const nextVisible = steps.find((step: IInstallStep, i: number) => i > idx && step.visible);
    const direction = nextVisible ? "forward" : "finish";
    events.emit(
      `fomod-installer-continue-${activeInstanceId}`,
      direction,
      this.props.installerState.currentStep,
    );
  };
  private cancel = () => {
    const { events } = this.context.api;
    const { activeInstanceId } = this.props;
    events.emit(`fomod-installer-cancel-${activeInstanceId}`);
  };
}

function mapStateToProps(state: IState): IConnectedProps {
  if (!state || !hasSessionFOMOD(state.session)) {
    return {
      installerInfo: undefined,
      installerState: undefined,
      activeInstanceId: undefined,
    };
  }

  // Use instance-specific state if available, fall back to legacy state for compatibility
  const activeInstanceId = state.session.fomod.installer?.dialog?.activeInstanceId;
  const instanceData = state.session.fomod.installer?.dialog?.instances?.[activeInstanceId];

  return {
    installerInfo: instanceData?.info,
    installerState: instanceData?.state,
    activeInstanceId,
  };
}

export default translate(["common"])(
  connect(mapStateToProps)(InstallerDialog),
) as React.ComponentClass<{}>;
