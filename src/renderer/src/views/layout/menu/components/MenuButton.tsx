import React, { type ButtonHTMLAttributes, type ComponentType, type FC } from "react";

import { useWindowContext } from "@/contexts";
import { Icon, type IIconSource } from "@/ui/components/icon/Icon";
import { getIconProps } from "@/ui/components/icon/utils/icon_props/iconProps.util";
import { Tooltip } from "@/ui/components/tooltip/Tooltip";
import { Typography } from "@/ui/components/typography/Typography";
import { joinClasses } from "@/ui/utils/joinClasses";

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: string;
  icon: IIconSource;
  isActive?: boolean;
  Badge?: ComponentType<React.PropsWithChildren<unknown>>;
  /** mORTEX : compteur discret à droite (mods installés, archives) */
  count?: number;
  /** mORTEX : en couleur pour ressortir, orange pour une page exclusive au Mac, bleu Socle pour Nexus */
  accent?: "mac" | "nexus";
  /** mORTEX : l'entrée saisie pendant qu'on la déplace */
  lifted?: boolean;
  /** mORTEX : entrée du groupe qui glisse pour faire place à celle qu'on déplace */
  sliding?: boolean;
  /** mORTEX : couleur choisie par l'utilisateur (Option + clic droit), à la place de l'accent */
  tint?: string;
}

export const MenuButton: FC<React.PropsWithChildren<MenuButtonProps>> = ({
  children,
  icon,
  isActive,
  Badge,
  count,
  accent,
  lifted,
  sliding,
  tint,
  style,
  ...props
}) => {
  const { menuIsCollapsed } = useWindowContext();

  return (
    <Tooltip content={children} disabled={!menuIsCollapsed} placement="right">
      <button
        className={joinClasses([
          "relative flex h-10 items-center gap-x-3 rounded-lg px-3 text-left transition-colors",
          "hover:bg-surface-mid hover:text-neutral-moderate focus-visible:z-1",
          isActive
            ? "mortex-menu-active bg-surface-low text-neutral-moderate"
            : tint !== undefined
              ? ""
              : accent === "mac"
                ? "mortex-menu-accent"
                : accent === "nexus"
                  ? "mortex-menu-accent-nexus"
                  : "text-neutral-subdued",
          lifted ? "mortex-menu-lifted" : "",
          sliding ? "mortex-menu-sliding" : "",
        ])}
        draggable={false}
        style={tint === undefined ? style : { ...style, color: tint }}
        {...props}
      >
        <Icon {...getIconProps(icon)} className="shrink-0" size="sm" />

        <Typography
          as="span"
          brand="none"
          className="grow truncate font-medium"
          typographyType="body-sm"
        >
          {children}
        </Typography>

        {count !== undefined && !menuIsCollapsed && (
          <span className="mortex-menu-count">
            {count >= 10000 ? `${Math.floor(count / 1000)} k` : count}
          </span>
        )}

        {Badge && <Badge />}
      </button>
    </Tooltip>
  );
};
