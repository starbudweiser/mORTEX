import React, { type FC } from "react";

import { useSwitchingProfile } from "../../hooks";
import { ModernContentPane } from "../components/ContentPane";
import { Header } from "../components/Header/Header";
import { SpineProvider } from "../components/Spine/SpineContext";
import { StatusBar } from "../components/StatusBar/StatusBar";
import { DialogLayer } from "./DialogLayer";
import { LayoutContainer } from "./LayoutContainer";
import { Menu } from "./menu/Menu";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ToastContainer } from "./ToastContainer";
import { UIBlocker } from "./UIBlocker";

export const ModernLayout: FC<React.PropsWithChildren<unknown>> = () => {
  const switchingProfile = useSwitchingProfile();

  return (
    <SpineProvider>
      <LayoutContainer className="flex h-full bg-surface-base">
        {/* mORTEX : plus de colonne d'icônes ; la barre latérale unique (Menu) la remplace */}
        <div className="flex min-w-0 grow flex-col">
          <Header />

          <div className="flex min-h-0 grow">
            {switchingProfile ? (
              <ProfileSwitcher />
            ) : (
              <>
                <Menu />

                <ModernContentPane />
              </>
            )}

            <DialogLayer />

            <ToastContainer />
          </div>

          <StatusBar />
        </div>
      </LayoutContainer>

      <UIBlocker />
    </SpineProvider>
  );
};
