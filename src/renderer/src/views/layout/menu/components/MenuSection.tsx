import React, { type FC, type ReactNode } from "react";

import { useWindowContext } from "@/contexts";

interface IMenuSectionProps {
  title: string;
  children: ReactNode;
}

/** mORTEX : groupe de la barre latérale, titré en petites capitales comme sur macOS */
export const MenuSection: FC<IMenuSectionProps> = ({ title, children }) => {
  const { menuIsCollapsed } = useWindowContext();

  return (
    <div className="mortex-menu-section flex flex-col gap-y-0.5">
      {menuIsCollapsed ? (
        <div className="mortex-menu-section-rule" />
      ) : (
        <h6 className="mortex-menu-section-title">{title}</h6>
      )}

      {children}
    </div>
  );
};
