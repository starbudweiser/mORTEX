/**
 * mORTEX (macOS) : réglage « Remplacer Community Shaders par Bottled Shaders sur Mac », activé par
 * défaut. Désactivé, les collections s'installent telles que l'auteur les a écrites.
 */
import * as React from "react";
import { ControlLabel, FormGroup, HelpBlock } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

import Toggle from "../../../controls/Toggle";
import type { IState } from "../../../types/IState";
import { setMacRenderSubstitution } from "../actions/settings";

function SettingsMacRender() {
  const { t } = useTranslation(["common"]);
  const dispatch = useDispatch();
  const enabled = useSelector(
    (state: IState) => (state.settings as any).collections?.macRenderSubstitution !== false,
  );
  const onToggle = React.useCallback(
    () => dispatch(setMacRenderSubstitution(!enabled)),
    [dispatch, enabled],
  );
  return (
    <form>
      <FormGroup controlId="mac-render-substitution">
        <ControlLabel>{t("Shaders on Mac")}</ControlLabel>

        <Toggle checked={enabled} onToggle={onToggle}>
          {t("Replace Community Shaders with Bottled Shaders on Mac")}
        </Toggle>

        <HelpBlock>
          {t(
            "Collections made for Windows bring the original Community Shaders, which doesn't work " +
              "with CrossOver. mORTEX installs Bottled Shaders instead and lists what it sets aside, " +
              "before anything is installed. It applies to the collections you add from now on.",
          )}
        </HelpBlock>
      </FormGroup>
    </form>
  );
}

export default SettingsMacRender;
