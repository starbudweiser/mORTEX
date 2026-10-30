import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";

import Dashlet from "../../controls/Dashlet";
import { log } from "../../logging";
import { crossoverBinDir } from "../../util/macos/bottles";
import type { SetupStep, StepStatus } from "../../util/macos/bottleSetup";
import { openSteam, runBottleSetup, setupSteps } from "../../util/macos/bottleSetup";
import { useOpenUrl } from "../mortex_assistant/useOpenUrl";

const CROSSOVER_URL = "https://www.codeweavers.com/crossover";
const LICENCES = [
  { label: "Steam", url: "https://store.steampowered.com/subscriber_agreement/" },
  { label: "Visual C++", url: "https://visualstudio.microsoft.com/license-terms/vs2022-cruntime/" },
  { label: ".NET", url: "https://dotnet.microsoft.com/dotnet_library_license.htm" },
];

const STEP_LABELS: Record<SetupStep, string> = {
  bottle: "Creating the bottle",
  vcredist: "Installing Visual C++",
  dotnet8: "Installing .NET 8",
  netfx48: "Installing .NET Framework 4.8",
  steam: "Installing Steam",
};

type Phase = "idle" | "running" | "done" | "failed";

/**
 * mORTEX : prépare une bouteille CrossOver pour Skyrim. Tout est créé ou téléchargé sur le Mac de
 * l'utilisateur après son accord, rien n'est livré avec l'appli.
 */
function BottleSetupDashlet() {
  const { t } = useTranslation(["common"]);
  const openUrl = useOpenUrl();
  const [netfx48, setNetfx48] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statuses, setStatuses] = useState<Partial<Record<SetupStep, StepStatus>>>({});
  const [error, setError] = useState<string>();

  const start = () => {
    setPhase("running");
    setStatuses({});
    setError(undefined);
    runBottleSetup({ netfx48 }, (step, status) =>
      setStatuses((previous) => ({ ...previous, [step]: status })),
    )
      .then(() => setPhase("done"))
      .catch((err: Error) => {
        log("warn", "Bottle setup failed", { error: err.message });
        setError(err.message);
        setPhase("failed");
      });
  };

  const launchSteam = () => {
    try {
      openSteam();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (crossoverBinDir() === undefined) {
    return (
      <Dashlet className="mortex-bottle-dashlet" title={t("Prepare Skyrim on your Mac")}>
        <div className="flex flex-col items-start gap-3">
          <p>
            {t(
              "Skyrim runs on Mac through CrossOver, a paid app from CodeWeavers with a free trial. Install it, and this card will prepare a bottle for you.",
            )}
          </p>
          <Button onClick={() => openUrl(CROSSOVER_URL)}>{t("Get CrossOver")}</Button>
        </div>
      </Dashlet>
    );
  }

  return (
    <Dashlet className="mortex-bottle-dashlet" title={t("Prepare Skyrim on your Mac")}>
      <div className="flex flex-col items-start gap-3">
        {phase === "idle" && (
          <>
            <p>
              {t(
                "No Skyrim was found. A CrossOver bottle can be prepared for you, with Steam, Visual C++ and .NET 8. You then sign in to Steam and install Skyrim yourself.",
              )}
            </p>
            <CheckboxField
              checked={netfx48}
              hints={t("Only for older tools such as Nemesis or FNIS. You can leave it out.")}
              label={t("Also install .NET Framework 4.8")}
              onChange={setNetfx48}
            />
            <p>
              {t(
                "Everything is downloaded from Valve and Microsoft. By continuing, you accept their licences:",
              )}{" "}
              {LICENCES.map((licence) => (
                <Button
                  appearance="weak"
                  brand="neutral"
                  key={licence.label}
                  size="sm"
                  onClick={() => openUrl(licence.url)}
                >
                  {licence.label}
                </Button>
              ))}
            </p>
            <Button onClick={start}>{t("Accept and prepare the bottle")}</Button>
          </>
        )}

        {phase !== "idle" && (
          <ul className="flex flex-col gap-1">
            {setupSteps({ netfx48 }).map((step) => (
              <li key={step}>
                {statuses[step] === "done" ? "✓ " : statuses[step] === "running" ? "… " : "· "}
                {t(STEP_LABELS[step])}
              </li>
            ))}
          </ul>
        )}

        {phase === "failed" && (
          <>
            <Alert severity="danger">
              {t("The bottle could not be prepared: {{error}}", { replace: { error } })}
            </Alert>
            <Button onClick={start}>{t("Try again")}</Button>
          </>
        )}

        {phase === "done" && (
          <>
            <Alert severity="success">
              {t(
                "The bottle is ready. Sign in to Steam and install Skyrim Special Edition, then search for games again.",
              )}
            </Alert>
            {error !== undefined && <Alert severity="danger">{error}</Alert>}
            <Button onClick={launchSteam}>{t("Open Steam")}</Button>
          </>
        )}
      </div>
    </Dashlet>
  );
}

export default BottleSetupDashlet;
