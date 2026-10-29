import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { type IIniFile, readEffective } from "../../util/macos/iniEdit";
import AdvancedView from "./AdvancedView";
import { SKYRIMSE_CATALOG } from "./catalog/skyrimse";
import type { IValueContext } from "./model";

const tt = (key: string, replace?: Record<string, unknown>) =>
  replace === undefined ? key : `${key} ${JSON.stringify(replace)}`;

const files: IIniFile[] = [
  { role: "prefs", path: "/x/SkyrimPrefs.ini", text: "[Display]\nfGamma=1.0000\nbUseTAA=1\n" },
  { role: "ini", path: "/x/Skyrim.ini", text: "[Mine]\nsNote=hello\n" },
];
const exe = [
  ["Display", "fGamma"],
  ["Display", "bUseTAA"],
  ["Audio", "bEnableAudio"],
] as const;

const view = (pending: Record<string, string> = {}) => {
  const onChange = vi.fn();
  const ctx: IValueContext = {
    effective: readEffective(files),
    defaults: new Map([["audio\u0000benableaudio", "1"]]),
    pending,
  };
  render(
    <AdvancedView catalog={SKYRIMSE_CATALOG} ctx={ctx} exe={exe} tt={tt} onChange={onChange} />,
  );
  return { onChange };
};

describe("AdvancedView", () => {
  it("lists what the INI files define, with the value, the Bethesda value and the file", () => {
    view();
    const row = screen.getByTestId("settings-advanced-display\u0000fgamma");
    expect(row).toHaveTextContent("fGamma");
    expect(row).toHaveTextContent("1.0000");
    expect(row).toHaveTextContent("SkyrimPrefs.ini");
    // un nom que l'exécutable ne connaît pas reste listé
    expect(screen.getByTestId("settings-advanced-mine\u0000snote")).toHaveTextContent("hello");
    // défini nulle part : masqué tant que le filtre est actif
    expect(screen.queryByTestId("settings-advanced-audio\u0000benableaudio")).toBeNull();
  });

  it("searches the whole list once the filter is off", async () => {
    view();
    await userEvent.click(screen.getByRole("checkbox", { name: "ui.advOnlyDefined" }));
    expect(screen.getByTestId("settings-advanced-audio\u0000benableaudio")).toHaveTextContent("1");
    await userEvent.type(screen.getByRole("textbox", { name: "ui.advSearch" }), "audio");
    expect(screen.queryByTestId("settings-advanced-display\u0000fgamma")).toBeNull();
    expect(screen.getByTestId("settings-advanced-audio\u0000benableaudio")).toBeInTheDocument();
  });

  it("edits a value on double-click and reports it on Enter", async () => {
    const { onChange } = view();
    await userEvent.dblClick(screen.getByText("hello"));
    const input = screen.getByRole("textbox", { name: "Mine sNote" });
    await userEvent.clear(input);
    await userEvent.type(input, "bye{Enter}");
    expect(onChange).toHaveBeenCalledWith("Mine", "sNote", "bye");
  });

  it("refuses a value of the wrong type for the name", async () => {
    const { onChange } = view();
    await userEvent.dblClick(screen.getByText("1"));
    const input = screen.getByRole("textbox", { name: "Display bUseTAA" });
    await userEvent.clear(input);
    await userEvent.type(input, "yes{Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("marks a pending change", () => {
    view({ gamma: "1.3" });
    const row = screen.getByTestId("settings-advanced-display\u0000fgamma");
    expect(row).toHaveTextContent("1.3");
    expect(row.className).toContain("bg-success-weak");
  });
});
