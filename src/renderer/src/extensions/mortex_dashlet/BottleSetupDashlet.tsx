import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { useMainContext } from "@/contexts";
import { Alert } from "@/ui/components/alert/Alert";
import { Button } from "@/ui/components/button/Button";
import { CheckboxField } from "@/ui/components/form/checkbox_field/CheckboxField";
import { Icon, type SymbolName } from "@/ui/components/icon/Icon";

import Dashlet from "../../controls/Dashlet";
import { log } from "../../logging";
import { crossoverBinDir, crossoverBottleDir } from "../../util/macos/bottles";
import type { DestinationIssue, SetupStep, StepStatus } from "../../util/macos/bottleSetup";
import {
  checkDestination,
  openSteam,
  runBottleSetup,
  setupSteps,
} from "../../util/macos/bottleSetup";
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

const ISSUE_TEXTS: Record<DestinationIssue, string> = {
  format: "This disk can't hold a bottle: choose a disk formatted as APFS or Mac OS Extended.",
  space: "Less than 30 GB is free here: Steam, Skyrim and your mods need more.",
};

type Phase = "idle" | "running" | "done" | "failed";
type StepState = StepStatus | "waiting" | "failed";

const STEP_STATES: Record<StepState, { icon: SymbolName; label: string }> = {
  done: { icon: "check_circle", label: "Finished" },
  running: { icon: "progress_activity", label: "In progress…" },
  waiting: { icon: "radio_button_unchecked", label: "Waiting" },
  failed: { icon: "report", label: "Not finished" },
};

function SetupProgress(props: {
  steps: SetupStep[];
  statuses: Partial<Record<SetupStep, StepStatus>>;
  phase: Phase;
}) {
  const { steps, statuses, phase } = props;
  const { t } = useTranslation(["common"]);
  const finished = steps.filter((step) => statuses[step] === "done").length;
  const stateOf = (step: SetupStep): StepState => {
    const status = statuses[step] ?? "waiting";
    return status === "running" && phase === "failed" ? "failed" : status;
  };

  return (
    <div className="mortex-setup-progress" data-phase={phase}>
      <div className="mortex-setup-summary">
        {t("Step {{current}} of {{total}}", {
          replace: { current: Math.min(finished + 1, steps.length), total: steps.length },
        })}
      </div>
      <div aria-hidden="true" className="mortex-setup-bar">
        <span style={{ transform: `scaleX(${finished / steps.length})` }} />
      </div>
      <ol className="mortex-setup-steps">
        {steps.map((step) => {
          const state = stateOf(step);
          return (
            <li data-state={state} key={step}>
              <Icon
                className={state === "running" ? "animate-spin reduce-motion:animate-none" : ""}
                name={STEP_STATES[state].icon}
                size="sm"
              />
              <span className="mortex-setup-label">{t(STEP_LABELS[step])}</span>
              <span className="mortex-setup-state">{t(STEP_STATES[state].label)}</span>
            </li>
          );
        })}
      </ol>
      {phase === "running" && (
        <p className="mortex-setup-hint">
          {t("This can take several minutes. You can keep using your Mac.")}
        </p>
      )}
    </div>
  );
}

/**
 * mORTEX : prépare une bouteille CrossOver pour Skyrim. Tout est créé ou téléchargé sur le Mac de
 * l'utilisateur après son accord, rien n'est livré avec l'appli.
 */
function BottleSetupDashlet() {
  const { t } = useTranslation(["common"]);
  const { api } = useMainContext();
  const openUrl = useOpenUrl();
  const [bottleDir, setBottleDir] = useState(crossoverBottleDir);
  const [issue, setIssue] = useState<DestinationIssue>();
  const [netfx48, setNetfx48] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [statuses, setStatuses] = useState<Partial<Record<SetupStep, StepStatus>>>({});
  const [error, setError] = useState<string>();
  const [steamStarting, setSteamStarting] = useState(false);

  const start = () => {
    setPhase("running");
    setStatuses({});
    setError(undefined);
    runBottleSetup({ netfx48, bottleDir }, (step, status) =>
      setStatuses((previous) => ({ ...previous, [step]: status })),
    )
      .then(() => setPhase("done"))
      .catch((err: Error) => {
        log("warn", "Bottle setup failed", { error: err.message });
        setError(err.message);
        setPhase("failed");
      });
  };

  const chooseFolder = () => {
    void api.selectDir({}).then(async (selected) => {
      if (!selected) return;
      const found = await checkDestination(selected);
      setIssue(found);
      if (found !== "format") setBottleDir(selected);
    });
  };

  const launchSteam = () => {
    try {
      openSteam(bottleDir);
      setError(undefined);
      setSteamStarting(true);
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
            <div className="flex items-center justify-between gap-3 self-stretch">
              <span className="min-w-0 break-words">
                {t("Bottle location: {{path}}", { replace: { path: bottleDir } })}
              </span>
              <Button appearance="moderate" brand="neutral" size="sm" onClick={chooseFolder}>
                {t("Change…")}
              </Button>
            </div>
            {issue !== undefined && (
              <Alert className="self-stretch" severity="warning">
                {t(ISSUE_TEXTS[issue])}
              </Alert>
            )}
            <CheckboxField
              checked={netfx48}
              fieldClassName="self-stretch"
              hints={t("Only for older tools such as Nemesis or FNIS. You can leave it out.")}
              label={t("Also install .NET Framework 4.8")}
              onChange={setNetfx48}
            />
            <p>
              {t(
                "Everything is downloaded from Valve and Microsoft. By continuing, you accept their licences:",
              )}
            </p>
            <div className="-ml-2 flex gap-1">
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
            </div>
            <Button onClick={start}>{t("Accept and prepare the bottle")}</Button>
          </>
        )}

        {(phase === "running" || phase === "failed") && (
          <SetupProgress phase={phase} statuses={statuses} steps={setupSteps({ netfx48 })} />
        )}

        {phase === "failed" && (
          <>
            <Alert className="self-stretch" severity="danger">
              {t(
                "The bottle could not be prepared. Check the chosen folder and your connection, then try again.",
              )}
            </Alert>
            <details className="mortex-setup-details">
              <summary>{t("Details")}</summary>
              <code>{error}</code>
            </details>
            <Button onClick={start}>{t("Try again")}</Button>
          </>
        )}

        {phase === "done" && (
          <>
            <Alert className="self-stretch" severity="success">
              {t(
                "The bottle is ready. Sign in to Steam and install Skyrim Special Edition, then search for games again.",
              )}
            </Alert>
            {error !== undefined && (
              <Alert className="self-stretch" severity="danger">
                {t(error)}
              </Alert>
            )}
            {steamStarting && (
              <p>{t("Steam is starting: its first update can take several minutes.")}</p>
            )}
            <Button onClick={launchSteam}>{t("Open Steam")}</Button>
          </>
        )}
      </div>
    </Dashlet>
  );
}

export default BottleSetupDashlet;
