import * as React from "react";

import { hasMacSymbols, MacSymbol } from "./macos/MacSymbol";
import { IconButton } from "./TooltipControls";

export interface ICollapseIconProps {
  position: "topleft" | "topright" | "bottomleft" | "bottomright";
  onClick: () => void;
  visible: boolean;
}

class CollapseIcon extends React.PureComponent<ICollapseIconProps, {}> {
  public render(): JSX.Element {
    const { onClick, position, visible } = this.props;

    // direction of the hide icon
    let iconUp = position === "bottomleft" || position === "bottomright";
    if (!visible) {
      iconUp = !iconUp;
    }

    const classes = ["collapseicon"];
    classes.push(`collapseicon-${visible ? "show" : "hide"}`);
    classes.push(`collapseicon-${position}`);

    // mORTEX (macOS) : le chevron officiel du système
    if (hasMacSymbols()) {
      return (
        <button
          className={`${classes.join(" ")} icon-button icon-button-horizontal btn btn-ghost`}
          type="button"
          onClick={onClick}
        >
          <MacSymbol name={iconUp ? "chevron.up" : "chevron.down"} />
        </button>
      );
    }

    return (
      <IconButton
        className={classes.join(" ")}
        bsStyle={"ghost"}
        tooltip=""
        icon={`showhide-${iconUp ? "up" : "down"}`}
        onClick={onClick}
      />
    );
  }
}

export default CollapseIcon;
