import * as React from "react";
import { ControlLabel, FormGroup, HelpBlock } from "react-bootstrap";
import type * as Redux from "redux";
import type { ThunkDispatch } from "redux-thunk";

import { ComponentEx, connect, translate } from "../../../controls/ComponentEx";
import { setAnalytics } from "../actions/analytics.action";

interface IConnectedProps {
  analytics: boolean;
  userInfo: any;
}

interface IActionProps {
  onSetAnalytics: (analytics: boolean) => void;
}

type IProps = IActionProps & IConnectedProps;

class SettingsAnalytics extends ComponentEx<IProps, {}> {
  public render(): JSX.Element {
    const { t, analytics, userInfo } = this.props;
    return (
      <form>
        <FormGroup controlId="analytics">
          <ControlLabel>{t("Data & Privacy")}</ControlLabel>

          <HelpBlock>
            {t("mORTEX sends no usage data. Error reports stay on your Mac, in the logs folder.")}
          </HelpBlock>
        </FormGroup>
      </form>
    );
  }

  private toggleAnalytics = () => {
    this.props.onSetAnalytics(!this.props.analytics);
  };
}

function mapStateToProps(state: any): IConnectedProps {
  return {
    analytics: state.settings.analytics.enabled,
    userInfo: state.persistent.nexus.userInfo,
  };
}

function mapDispatchToProps(dispatch: ThunkDispatch<any, null, Redux.Action>): IActionProps {
  return {
    onSetAnalytics: (analytics: boolean): void => {
      dispatch(setAnalytics(analytics));
    },
  };
}

export default translate(["common"])(
  connect(mapStateToProps, mapDispatchToProps)(SettingsAnalytics),
) as React.ComponentClass<{}>;
