import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { eventSlug, keysText, remappableGroups } from "./controlGroups";
import { parseControlMap } from "./controlMap";
import type * as ControlsModule from "./controls";
import type { ILoadedControls } from "./controls";
import ControlsView from "./ControlsView";

const T = "\t";
const TABLE = [
  "// Main Gameplay",
  `Forward${T}${T}0x11${T}0xff${T}0xff${T}1${T}1${T}0`,
  `Back${T}${T}0x1f${T}0xff${T}0xff${T}1${T}1${T}0`,
  `Sprint${T}${T}0x38${T}0xff${T}0xff${T}1${T}1${T}1`,
  `Odd Action${T}${T}0x2c${T}0xff${T}0xff${T}1${T}1${T}1`,
  `Hotkey1${T}${T}0x02${T}0xff${T}0xff${T}0${T}0${T}0`,
  "",
].join("\r\n");

vi.mock("./controls", async (importOriginal) => ({
  ...(await importOriginal<typeof ControlsModule>()),
  loadControls: vi.fn(async (): Promise<ILoadedControls> => {
    const base = parseControlMap(TABLE);
    return {
      base,
      current: base,
      source: "Skyrim - Interface.bsa",
      customPath: "/x/ControlMap_Custom.txt",
      customExists: false,
    };
  }),
}));

const tt = (key: string, replace?: Record<string, unknown>) =>
  replace === undefined ? key : `${key} ${JSON.stringify(replace)}`;

const api = {
  sendNotification: vi.fn(),
  showDialog: vi.fn(),
  showErrorNotification: vi.fn(),
} as unknown as IExtensionApi;

const renderView = () =>
  render(
    <ControlsView
      api={api}
      gamePath="/game"
      iniDir="/x"
      toolRunning={false}
      tt={tt}
      onSaved={() => undefined}
    />,
  );

describe("controlGroups", () => {
  it("ne garde que les événements remappables, rangés par groupe, les inconnus à part", () => {
    const groups = remappableGroups(parseControlMap(TABLE));
    expect(groups.map((g) => [g.id, g.events.map((e) => e.name)])).toEqual([
      ["movement", ["Forward", "Back", "Sprint"]],
      ["other", ["Odd Action"]],
    ]);
  });

  it("donne un identifiant stable à chaque événement et un texte aux touches", () => {
    expect(eventSlug("Left Attack/Block")).toBe("left_attack_block");
    expect(eventSlug("Auto-Move")).toBe("auto_move");
    expect(keysText([[0x38]], "—")).toBe("⌥ Option");
    expect(keysText([[0x02], [0x4f]], "—")).toBe("1 / Num 1");
    expect(keysText([[0x1d, 0xb7]], "—")).toBe("⌃ Control + Print Screen");
    expect(keysText([], "—")).toBe("—");
  });
});

describe("ControlsView", () => {
  it("montre les actions modifiables avec leur touche, sans les événements fixes", async () => {
    renderView();
    const forward = await screen.findByTestId("controls-row-forward");
    expect(forward).toHaveTextContent("ui.ctl.forward");
    expect(forward).toHaveTextContent("W");
    expect(screen.getByTestId("controls-row-sprint")).toHaveTextContent("⌥ Option");
    expect(screen.getByTestId("controls-row-odd_action")).toHaveTextContent("Odd Action");
    expect(screen.queryByTestId("controls-row-hotkey1")).toBeNull();
  });

  it("change une touche : clic, puis appui sur la nouvelle ; la ligne est marquée modifiée", async () => {
    renderView();
    const row = await screen.findByTestId("controls-row-forward");
    await userEvent.click(row.querySelector("button")!);
    expect(row).toHaveTextContent("ui.ctlPress");
    fireEvent.keyDown(window, { code: "ArrowUp" });
    await waitFor(() => expect(row).toHaveTextContent("↑"));
    expect(row.className).toContain("bg-success-weak");
    expect(row).toHaveTextContent("ui.ctlDefault");
    expect(screen.getByText(/ui.pending/)).toHaveTextContent('"count":1');
  });

  it("Échap annule la saisie sans rien changer", async () => {
    renderView();
    const row = await screen.findByTestId("controls-row-forward");
    await userEvent.click(row.querySelector("button")!);
    fireEvent.keyDown(window, { code: "Escape" });
    await waitFor(() => expect(row).toHaveTextContent("W"));
    expect(row).not.toHaveTextContent("ui.ctlPress");
  });

  it("signale une touche déjà prise et bloque l'enregistrement", async () => {
    renderView();
    const back = await screen.findByTestId("controls-row-back");
    await userEvent.click(back.querySelector("button")!);
    fireEvent.keyDown(window, { code: "KeyW" });
    await waitFor(() => expect(back).toHaveTextContent("ui.ctlConflict"));
    expect(screen.getByTestId("controls-row-forward")).toHaveTextContent("ui.ctlConflict");
    expect(screen.getByText("ui.ctlBlocked")).toBeTruthy();
    expect(screen.getByRole("button", { name: /ui.save/ })).toBeDisabled();
  });

  it("trouve les actions qui utilisent une touche", async () => {
    renderView();
    await screen.findByTestId("controls-row-forward");
    await userEvent.click(screen.getByRole("button", { name: /ui.ctlFind/ }));
    fireEvent.keyDown(window, { code: "AltLeft" });
    await waitFor(() => expect(screen.getByText(/ui.ctlFindResult/)).toBeTruthy());
    expect(screen.getByText(/ui.ctlFindResult/)).toHaveTextContent("ui.ctl.sprint");
    expect(screen.getByTestId("controls-row-sprint").className).toContain("bg-warning-weak");
  });

  it("annule les changements en attente", async () => {
    renderView();
    const row = await screen.findByTestId("controls-row-forward");
    await userEvent.click(row.querySelector("button")!);
    fireEvent.keyDown(window, { code: "ArrowUp" });
    await waitFor(() => expect(row).toHaveTextContent("↑"));
    await userEvent.click(screen.getByRole("button", { name: /ui.revert/ }));
    await waitFor(() => expect(row).toHaveTextContent("W"));
  });
});
