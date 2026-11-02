/**
 * mORTEX (macOS) : encart du dialogue de départ quand Bottled Shaders prend la place de Community
 * Shaders. Il dit, avant que rien ne se fasse, ce qui est remplacé, ce qui n'est pas installé et
 * pourquoi, avertit que les réglages de la collection ne sont pas garantis avec Bottled, et propose
 * trois choix pour eux. Un bouton, centré en bas, rend la main à Community Shaders.
 */
import * as React from "react";
import { Button } from "react-bootstrap";

import type { TFunction } from "../../../../util/i18n";
import type { ISafetyNetResult } from "../../util/bottledSafetyNet";
import {
  BOTTLED_SETTINGS_CHOICES,
  BOTTLED_SETTINGS_TEXTS,
  type BottledSettingsChoice,
} from "../../util/bottledSettings";
import type { ISubstitution } from "../../util/macRenderSubstitution";

export interface IBottledNoticeProps {
  t: TFunction;
  substitution: ISubstitution;
  choice: BottledSettingsChoice;
  /** le joueur a demandé le Community Shaders de la collection */
  off: boolean;
  /** compte gratuit : le téléchargement de Bottled demande un clic sur sa page Nexus */
  freeAccount: boolean;
  onChoice: (choice: BottledSettingsChoice) => void;
  onKeepStock: () => void;
}

function BottledNotice(props: IBottledNoticeProps) {
  const { t, substitution, choice, freeAccount, off, onChoice, onKeepStock } = props;
  const { replaced, bottled, removed } = substitution;
  if (off) {
    return (
      <section className="collection-start-bottled">
        <h4>{t("This collection installs the original Community Shaders")}</h4>

        <p>
          {t(
            "Community Shaders {{version}} doesn't work on a Mac: expect a red screen and shaders " +
              "that fail to compile. Bottled Shaders is the version made for CrossOver.",
            { replace: { version: replaced.version } },
          )}
        </p>

        <div className="collection-start-bottled-actions">
          <Button bsSize="sm" onClick={onKeepStock}>
            {t("Use Bottled Shaders instead (recommended)")}
          </Button>
        </div>
      </section>
    );
  }
  return (
    <section className="collection-start-bottled">
      <h4>{t("Bottled Shaders replaces Community Shaders on Mac")}</h4>

      <p>
        {t(
          "This collection installs Community Shaders {{version}}, which doesn't work on a Mac. " +
            "mORTEX installs Bottled Shaders {{bottled}} instead: the version of Community Shaders " +
            "made for CrossOver.",
          { replace: { version: replaced.version, bottled: bottled.version } },
        )}
      </p>

      {removed.length > 0 ? (
        <>
          <p className="collection-start-bottled-label">{t("Not installed:")}</p>

          <ul className="collection-start-bottled-list">
            {removed.map((mod) => (
              <li key={`${mod.modId ?? ""}-${mod.name}`}>
                <strong>{mod.name}</strong>

                <span>
                  {mod.reason === "incompatible"
                    ? t("makes the game crash with Bottled Shaders")
                    : t("already included in Bottled Shaders")}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {freeAccount ? (
        <p className="collection-start-hint">
          {t("With a free Nexus Mods account, you click Download on the page of Bottled Shaders.")}
        </p>
      ) : null}

      <div className="collection-start-bottled-settings">
        <h5>{t("Community Shaders settings of this collection")}</h5>

        <p className="collection-start-bottled-warning">
          {t(
            "These settings were made for the original Community Shaders. Nothing guarantees that " +
              "they work with Bottled Shaders.",
          )}
        </p>

        {BOTTLED_SETTINGS_CHOICES.map((id) => (
          <label className="collection-start-bottled-choice" key={id}>
            <input
              checked={choice === id}
              name="bottled-settings"
              type="radio"
              onChange={() => onChoice(id)}
            />

            <span>
              <strong>{t(BOTTLED_SETTINGS_TEXTS[id].title)}</strong>

              <small>{t(BOTTLED_SETTINGS_TEXTS[id].detail)}</small>
            </span>
          </label>
        ))}
      </div>

      <div className="collection-start-bottled-actions">
        <Button bsSize="sm" onClick={onKeepStock}>
          {t("Keep the Community Shaders of the collection")}
        </Button>
      </div>
    </section>
  );
}

export interface IBottledNetProps {
  t: TFunction;
  result: ISafetyNetResult;
  onUndo: () => void;
}

/** bilan de fin d'installation : ce que le filet a désactivé, avec « Annuler » */
export function BottledNetSummary({ t, result, onUndo }: IBottledNetProps) {
  return (
    <section className="collection-start-bottled collection-finished-bottled">
      <h4>
        {result.undone === true
          ? t("Mods enabled again")
          : t("Disabled: Bottled Shaders already includes them")}
      </h4>

      <ul className="collection-start-bottled-list">
        {result.disabled.map((mod) => (
          <li key={mod.id}>
            <strong>{mod.name}</strong>
          </li>
        ))}
      </ul>

      <p className="collection-start-hint">
        {result.undone === true
          ? t(
              "These mods may stop Bottled Shaders from working. Disable them again if the game crashes.",
            )
          : t("The mods stay installed, you can enable them again.")}
      </p>

      {result.undone === true ? null : (
        <div className="collection-start-bottled-actions">
          <Button bsSize="sm" onClick={onUndo}>
            {t("Undo")}
          </Button>
        </div>
      )}
    </section>
  );
}

export default BottledNotice;
