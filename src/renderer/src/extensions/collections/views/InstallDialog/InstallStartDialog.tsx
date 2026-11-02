import * as path from "path";

import * as React from "react";
import { Button } from "react-bootstrap";
import { withTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { connect } from "react-redux";
import Select from "react-select";
import type * as Redux from "redux";
import { generate as shortid } from "shortid";

import * as actions from "../../../../actions";
import { ComponentEx } from "../../../../controls/ComponentEx";
import Image from "../../../../controls/Image";
import Modal from "../../../../controls/Modal";
import More from "../../../../controls/More";
import Toggle from "../../../../controls/Toggle";
import { getGame } from "../../../../extensions/gamemode_management/util/getGame";
import type { IMod, IModRule } from "../../../../extensions/mod_management/types/IMod";
import renderModName from "../../../../extensions/mod_management/util/modName";
import { isDependencyRule } from "../../../../extensions/mod_management/util/testModReference";
import getTextProfileManagement from "../../../../extensions/profile_management/texts";
import type { IProfile } from "../../../../extensions/profile_management/types/IProfile";
import type { IState } from "../../../../types/IState";
import { Alert } from "../../../../ui/components/alert/Alert";
import getVortexPath from "../../../../util/getVortexPath";
import type { TFunction } from "../../../../util/i18n";
import { getSafe } from "../../../../util/storeHelper";
import { batchDispatch, bytesToString } from "../../../../util/util";
import { downloadPathForGame } from "../../../download_management/selectors";
import type { IDownload } from "../../../download_management/types/IDownload";
import { installPathForGame } from "../../../mod_management/selectors";
import { setBottledSettingsChoice } from "../../actions/settings";
import { DEFAULT_INSTRUCTIONS, NAMESPACE } from "../../constants";
import {
  ATTR_SETTINGS_CHOICE,
  type BottledSettingsChoice,
  isBottledSettingsChoice,
} from "../../util/bottledSettings";
import { useBottledShaders, useStockCommunityShaders } from "../../util/bottledSwap";
import { estimateSpace, type ISpaceEstimate, volumeOf } from "../../util/diskSpace";
import { isGamebryoGame } from "../../util/gameSupport";
import type InstallDriver from "../../util/InstallDriver";
import {
  ATTR_SUBSTITUTION,
  ATTR_SUBSTITUTION_OFF,
  type ISubstitution,
} from "../../util/macRenderSubstitution";
import BottledNotice from "./BottledNotice";
import YouCuratedTag from "./YouCuratedThisTag";

interface IInstallDialogProps {
  onHide: () => void;
  visible: boolean;
  driver: InstallDriver;
  onSwitchProfile: (profileId: string) => Promise<void>;
}

interface IConnectedProps {
  allProfiles: { [profileId: string]: IProfile };
  mods: { [modId: string]: IMod };
  isPremium: boolean;
  userInfo: { userId: number };
  nextProfileId: string;
  collectionsInstallWhileDownloading: boolean;
  useModernLayout: boolean;
  downloads: { [id: string]: IDownload };
  downloadPath: string | undefined;
  modsPath: string | undefined;
}

interface IActionProps {
  onAddProfile: (profile: IProfile) => void;
  onSetCollectionConcurrency: (enabled: boolean) => void;
  onSetBottledChoice: (choice: BottledSettingsChoice) => void;
  onSetModAttribute: (gameId: string, modId: string, key: string, value: any) => void;
  onSetModAttributes: (gameId: string, modId: string, attributes: { [key: string]: any }) => void;
  onAddRule: (gameId: string, modId: string, rule: IModRule) => void;
  onRemoveRule: (gameId: string, modId: string, rule: IModRule) => void;
  onSetProfilesVisible: () => void;
  onShowProfilesPage: (useModernLayout: boolean) => void;
}

type IProps = IInstallDialogProps & IConnectedProps & IActionProps;

interface IInstallDialogState {
  selectedProfile: string;
  confirmProfile: boolean;
  recommendedNewProfile: boolean;
  skipPluginRules: boolean;
}

function nop() {
  // nop
}

interface IInstallDialogSelectProfileProps {
  t: TFunction;
  profile: IProfile;
  selectedProfile: string;
  recommendedNewProfile: boolean;
  allProfiles: { [profileId: string]: IProfile };
  onSelectProfile: (value: { value: string; label: string }) => void;
}

function InstallDialogSelectProfile(props: IInstallDialogSelectProfileProps) {
  const { t, allProfiles, onSelectProfile, profile, selectedProfile, recommendedNewProfile } =
    props;

  const profileOptions = Object.keys(allProfiles)
    .filter((profId) => allProfiles[profId].gameId === profile.gameId)
    .map((profId) => ({
      value: profId,
      label:
        profId === profile.id
          ? t("{{name}} (Current)", { replace: { name: profile.name } })
          : allProfiles[profId].name,
    }))
    .concat({
      value: "__new",
      label: t("Create new profile{{recommended}}", {
        replace: {
          recommended: recommendedNewProfile ? t(" (Recommended by curator)") : "",
        },
      }),
    });

  return (
    <Select
      className="collection-start-select"
      clearable={false}
      options={profileOptions}
      value={selectedProfile ?? profile.id}
      onChange={onSelectProfile}
    />
  );
}

interface IInstallDialogConfirmProfileProps {
  t: TFunction;
  collectionName: string;
  selectedProfile: IProfile;
}

function InstallDialogConfirmProfile(props: IInstallDialogConfirmProfileProps) {
  const { t, collectionName, selectedProfile } = props;

  const profileName = selectedProfile?.name ?? collectionName;

  return (
    <div className="collection-start-confirm">
      <p>
        {t("Currently installing to profile: {{profileName}}", {
          replace: {
            profileName,
          },
        })}
      </p>

      <p>{t("Do you want to switch to this profile?")}</p>
    </div>
  );
}

/**
 * Installation prompt that shows up when the user imports a collection
 */
class InstallDialog extends ComponentEx<IProps, IInstallDialogState> {
  private mLastCollection: IMod;
  private mUnsubscribeDriver?: () => void;
  private mSpace?: { collection: IMod; estimate?: ISpaceEstimate };
  constructor(props: IProps) {
    super(props);

    this.initState({
      selectedProfile: undefined,
      confirmProfile: false,
      recommendedNewProfile: false,
      skipPluginRules: false,
    });
  }

  public componentDidMount() {
    // subscribe here, not in the constructor: a constructor subscription can fire forceUpdate
    // before this instance mounts (or on an instance that never mounts at all)
    if (this.props.driver !== undefined) {
      this.mUnsubscribeDriver = this.props.driver.onUpdate(() => this.forceUpdate());
    }
  }

  public componentWillUnmount() {
    this.mUnsubscribeDriver?.();
    this.mUnsubscribeDriver = undefined;
  }

  static getDerivedStateFromProps(props: IProps, state: IInstallDialogState) {
    if (!state.selectedProfile && !!props.driver?.collection?.attributes?.recommendNewProfile) {
      return {
        recommendedNewProfile: true,
        selectedProfile: "__new",
      };
    }
    return null;
  }

  public componentDidUpdate(prevProps: IProps) {
    const { driver } = this.props;
    if (driver !== undefined) {
      if (driver !== prevProps.driver) {
        // drop the old driver's hook before subscribing to the new one, so a stale handler
        // doesn't linger and forceUpdate after the driver swap
        this.mUnsubscribeDriver?.();
        this.mUnsubscribeDriver = driver.onUpdate(() => this.forceUpdate());
      }

      if (driver.collection !== this.mLastCollection) {
        this.nextState.confirmProfile = false;
        this.nextState.selectedProfile = undefined;
        this.mLastCollection = driver.collection;
      }
    }
  }

  public render(): React.ReactNode {
    const { t, driver, allProfiles, nextProfileId, userInfo } = this.props;
    const { selectedProfile, recommendedNewProfile } = this.state;

    if (driver?.profile === undefined) {
      return null;
    }

    const { profile } = driver;

    if (nextProfileId !== profile.id) {
      return null;
    }

    // pas d'instructions du curateur : rien à montrer, le bloc disparaît
    const customInstructions = driver.collection?.attributes?.installInstructions;
    const hasInstructions =
      !!customInstructions?.trim() && customInstructions !== DEFAULT_INSTRUCTIONS;
    let installInstructions = customInstructions ?? "";

    // used to convert a \n into something that react-markdown can use to detect paragraphs properly
    installInstructions = installInstructions.replace(/\r?\n/g, "  \r\n");

    const game = getGame(profile.gameId);

    const ownCollection: boolean =
      userInfo?.userId !== undefined && driver.collectionInfo?.user?.memberId === userInfo?.userId;
    const collectionName = renderModName(driver.collection);
    const attributes = driver.collection?.attributes;
    const modCount = (driver.collection?.rules ?? []).filter(isDependencyRule).length;
    const covers = [
      attributes?.pictureUrl,
      path.join(getVortexPath("assets"), "images", "collection_fallback_tile.png"),
    ].filter((iter) => iter !== undefined);
    return (
      <Modal
        id="collection-start"
        show={driver.collection !== undefined && driver.step === "query"}
        onHide={nop}
      >
        <Modal.Body>
          <header className="collection-start-hero">
            <Image circle={false} className="collection-start-cover" srcs={covers} />

            <div className="collection-start-heading">
              <p className="collection-start-eyebrow">
                {t("{{gameName}} collection added", {
                  replace: { gameName: game.name },
                })}
              </p>

              <h3>{collectionName}</h3>

              <p className="collection-start-meta">
                {attributes?.author !== undefined
                  ? t("by {{author}}", { replace: { author: attributes.author } }) + " · "
                  : ""}

                {t("Revision {{number}}", { replace: { number: attributes?.version ?? "0" } })}
              </p>

              <div className="collection-start-tags">
                <span className="collection-start-tag">
                  {t("{{mods}} mods", { replace: { mods: modCount } })}
                </span>

                {ownCollection ? <YouCuratedTag t={t} /> : null}
              </div>
            </div>
          </header>

          {this.renderSpace()}

          {this.renderBottled()}

          {hasInstructions ? (
            <section className="collection-start-instructions">
              <h4>{t("Collection instructions")}</h4>

              <ReactMarkdown
                allowedElements={["p", "br", "a", "em", "strong"]}
                className="textarea-install-collection-instructions"
                unwrapDisallowed={true}
              >
                {installInstructions}
              </ReactMarkdown>

              <p className="collection-start-hint">
                {t("Instructions can be reviewed during installation.")}
              </p>
            </section>
          ) : null}

          {this.state.confirmProfile && selectedProfile !== undefined ? (
            <InstallDialogConfirmProfile
              collectionName={collectionName}
              selectedProfile={
                selectedProfile === "__new" ? undefined : allProfiles[selectedProfile]
              }
              t={t}
            />
          ) : (
            <div className="collection-start-options">
              <div className="collection-start-option">
                <span>
                  {t("Profile")}

                  <More id="more-profile-instcollection" name={t("Profiles")} wikiId="profiles">
                    {getTextProfileManagement("profiles", t)}
                  </More>
                </span>

                <InstallDialogSelectProfile
                  allProfiles={allProfiles}
                  profile={profile}
                  recommendedNewProfile={recommendedNewProfile}
                  selectedProfile={selectedProfile}
                  t={t}
                  onSelectProfile={this.changeProfile}
                />
              </div>

              <div className="collection-start-option">
                <span>{t("Install mods during collection downloads")}</span>

                <Toggle
                  checked={this.props.collectionsInstallWhileDownloading}
                  onToggle={this.props.onSetCollectionConcurrency}
                />
              </div>

              {isGamebryoGame(profile.gameId) ? (
                <div className="collection-start-option">
                  <span>
                    {t("Skip plugin rules")}

                    <More id="install-skip-plugin-rules" name={t("Skip plugin rules")}>
                      {t(
                        "If enabled, custom LOOT plugin rules and groups included in this collection " +
                          "will not be applied. This can help prevent inherited plugin rules from " +
                          "causing conflicts.",
                      )}
                    </More>
                  </span>

                  <Toggle
                    checked={this.state.skipPluginRules}
                    onToggle={this.toggleSkipPluginRules}
                  />
                </div>
              ) : null}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          {this.state.confirmProfile ? (
            <>
              <Button onClick={this.next}>{t("No")}</Button>

              <Button className="collection-start-primary" onClick={this.switchProfile}>
                {t("Yes")}
              </Button>
            </>
          ) : (
            <>
              <Button onClick={this.cancel}>{t("Later")}</Button>

              <Button className="collection-start-primary" onClick={this.next}>
                {t("Install Now")}
              </Button>
            </>
          )}
        </Modal.Footer>
      </Modal>
    );
  }

  /** mORTEX (macOS) : Bottled Shaders à la place de Community Shaders, annoncé avant l'installation */
  private renderBottled(): React.ReactNode {
    const { t, driver, isPremium } = this.props;
    const attributes = driver.collection?.attributes;
    const substitution: ISubstitution | undefined = attributes?.[ATTR_SUBSTITUTION];
    if (substitution === undefined) {
      return null;
    }
    const stored = attributes?.[ATTR_SETTINGS_CHOICE];
    return (
      <BottledNotice
        choice={isBottledSettingsChoice(stored) ? stored : "mortex"}
        freeAccount={!isPremium}
        off={attributes?.[ATTR_SUBSTITUTION_OFF] === true}
        substitution={substitution}
        t={t}
        onChoice={this.chooseBottledSettings}
        onKeepStock={this.toggleStockShaders}
      />
    );
  }

  private chooseBottledSettings = (choice: BottledSettingsChoice) => {
    const { driver, onSetModAttribute, onSetBottledChoice } = this.props;
    if (driver?.collection !== undefined) {
      onSetModAttribute(driver.profile.gameId, driver.collection.id, ATTR_SETTINGS_CHOICE, choice);
      // le prochain choix par défaut
      onSetBottledChoice(choice);
    }
  };

  private toggleStockShaders = () => {
    const { driver } = this.props;
    const collection = driver?.collection;
    if (collection === undefined) {
      return;
    }
    const off = collection.attributes?.[ATTR_SUBSTITUTION_OFF] === true;
    const { api } = this.context;
    const gameId = driver.profile.gameId;
    const swapped: Promise<unknown> = off
      ? useBottledShaders(api, gameId, collection.id)
      : useStockCommunityShaders(api, gameId, collection.id);
    swapped
      .catch((err) => api.showErrorNotification("Failed to change the shaders", err))
      .finally(() => this.forceUpdate());
  };

  private changeProfile = (value: { value: string; label: string }) => {
    if (value) {
      this.nextState.selectedProfile = value.value;
    }
  };

  private toggleSkipPluginRules = (checked: boolean) => {
    this.nextState.skipPluginRules = checked;
    const { driver, onSetModAttribute } = this.props;
    if (driver?.collection !== undefined) {
      onSetModAttribute(driver.profile.gameId, driver.collection.id, "skipPluginRules", checked);
    }
  };

  private cancel = () => {
    this.props.driver.cancel();
  };

  private next = () => {
    if (
      !this.state.confirmProfile &&
      this.state.selectedProfile !== undefined &&
      this.state.selectedProfile !== this.props.driver?.profile?.id
    ) {
      if (this.state.selectedProfile === "__new") {
        const { driver, onAddProfile, onShowProfilesPage, useModernLayout } = this.props;
        const { profile } = driver;

        const profileId = shortid();
        const name = renderModName(driver.collection);
        const newProfile = {
          id: profileId,
          gameId: profile.gameId,
          name,
          modState: {},
          lastActivated: 0,
          // mORTEX : pour proposer de supprimer ce profil quand la collection sera retirée
          createdForCollection: driver.collection.id,
        };
        onAddProfile(newProfile);
        onShowProfilesPage(useModernLayout);
        this.nextState.selectedProfile = profileId;
      }
      this.nextState.confirmProfile = true;
    } else {
      this.startInstall();
    }
  };

  private switchProfile = async () => {
    const { selectedProfile } = this.state;
    await this.props.onSwitchProfile(selectedProfile);

    // Make sure the profiles page is visible and navigate to it.
    this.props.onShowProfilesPage(this.props.useModernLayout);
    this.startInstall();
  };

  // mORTEX : calculé une fois par collection (statfs), pas à chaque rendu
  private renderSpace(): React.ReactNode {
    const { t, driver, downloads, downloadPath, modsPath } = this.props;
    if (this.mSpace?.collection !== driver.collection) {
      const downloadsVolume = volumeOf(downloadPath);
      const modsVolume = volumeOf(modsPath);
      this.mSpace = {
        collection: driver.collection,
        estimate:
          downloadsVolume !== undefined && modsVolume !== undefined
            ? estimateSpace(driver.collection?.rules ?? [], downloads, {
                downloads: downloadsVolume,
                mods: modsVolume,
              })
            : undefined,
      };
    }
    const { estimate } = this.mSpace;
    if (estimate === undefined || estimate.archives === 0) {
      return null;
    }
    const replace = {
      needed: bytesToString(estimate.toDownload + estimate.installed),
      archives: bytesToString(estimate.archives),
      free: bytesToString(estimate.free),
      missing: bytesToString(estimate.missing),
    };
    const needed = estimate.toDownload + estimate.installed;
    const share = Math.min(1, needed / Math.max(1, estimate.free));
    const level = estimate.missing > 0 ? "full" : share > 0.7 ? "tight" : "ok";
    return (
      <section className="collection-start-space" data-level={level}>
        <div className="collection-start-space-head">
          <span>{t("Disk space")}</span>

          <span>{t("{{needed}} needed, {{free}} free", { replace })}</span>
        </div>

        <div aria-hidden="true" className="collection-start-gauge">
          <span style={{ transform: `scaleX(${share})` }} />
        </div>

        {estimate.missing > 0 ? (
          <Alert className="collection-disk-space" severity="warning">
            {t(
              "Not enough disk space: this collection needs about {{needed}} ({{archives}} of " +
                "archives, roughly twice that once installed). {{missing}} more must be freed " +
                "before installing.",
              { replace },
            )}
          </Alert>
        ) : null}
      </section>
    );
  }

  private startInstall() {
    const { allProfiles, driver } = this.props;
    const { selectedProfile } = this.state;

    const { profile } = driver;

    if (selectedProfile !== undefined && selectedProfile !== profile.id) {
      driver.profile = allProfiles[selectedProfile];
    }

    driver.continue();
  }
}

const emptyObject = {};

function mapStateToProps(state: IState, ownProps: IInstallDialogProps): IConnectedProps {
  const { editCollectionId } = (state.session as any).collections;
  const gameMode = ownProps.driver?.profile?.gameId;

  const isPremium = getSafe(state, ["persistent", "nexus", "userInfo", "isPremium"], false);
  const collectionsInstallWhileDownloading = getSafe(
    state,
    ["settings", "downloads", "collectionsInstallWhileDownloading"],
    true,
  );
  const { userInfo } = state.persistent["nexus"] ?? {};
  return {
    allProfiles: state.persistent.profiles,
    mods: editCollectionId !== undefined ? state.persistent.mods[gameMode] : emptyObject,
    isPremium,
    userInfo,
    nextProfileId: state.settings.profiles.nextProfileId,
    collectionsInstallWhileDownloading,
    useModernLayout: state.settings.window.useModernLayout ?? true,
    downloads: state.persistent.downloads.files,
    downloadPath: downloadPathForGame(state, gameMode),
    modsPath: installPathForGame(state, gameMode),
  };
}

function mapDispatchToProps(dispatch: Redux.Dispatch): IActionProps {
  return {
    onSetModAttribute: (gameId: string, modId: string, key: string, value: any) =>
      dispatch(actions.setModAttribute(gameId, modId, key, value)),
    onSetModAttributes: (gameId: string, modId: string, attributes: { [key: string]: any }) =>
      dispatch(actions.setModAttributes(gameId, modId, attributes)),
    onAddRule: (gameId: string, modId: string, rule: IModRule) =>
      dispatch(actions.addModRule(gameId, modId, rule)),
    onRemoveRule: (gameId: string, modId: string, rule: IModRule) =>
      dispatch(actions.removeModRule(gameId, modId, rule)),
    onAddProfile: (profile: IProfile) => dispatch(actions.setProfile(profile)),
    onSetProfilesVisible: () => dispatch(actions.setProfilesVisible(true)),
    onShowProfilesPage: (useModernLayout: boolean) =>
      batchDispatch(dispatch, [
        actions.setProfilesVisible(true),
        actions.setOpenMainPage(useModernLayout ? "game-profiles" : "Profiles", false),
      ]),
    onSetCollectionConcurrency: (enabled: boolean) =>
      dispatch(actions.setCollectionConcurrency(enabled)),
    onSetBottledChoice: (choice: BottledSettingsChoice) =>
      dispatch(setBottledSettingsChoice(choice)),
  };
}

export default withTranslation(["common", NAMESPACE])(
  connect(mapStateToProps, mapDispatchToProps)(React.memo(InstallDialog)) as any,
) as React.ComponentClass<IInstallDialogProps>;
