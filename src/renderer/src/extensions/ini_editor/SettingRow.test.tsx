import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { type IIniFile, readEffective } from "../../util/macos/iniEdit";
import { SKYRIMSE_CATALOG } from "./catalog/skyrimse";
import type { IValueContext } from "./model";
import SettingRow from "./SettingRow";

const setting = (id: string) => SKYRIMSE_CATALOG.find((s) => s.id === id)!;
const tt = (key: string, replace?: Record<string, unknown>) =>
  replace === undefined ? key : `${key} ${JSON.stringify(replace)}`;

const files: IIniFile[] = [
  {
    role: "prefs",
    path: "/x/SkyrimPrefs.ini",
    text: "[Display]\nbUseTAA=1\nfGamma=1.0000\niShadowMapResolution=2048\n",
  },
];

const ctx = (pending: Record<string, string> = {}): IValueContext => ({
  effective: readEffective(files),
  defaults: new Map(),
  pending,
});

const row = (id: string, props: Partial<React.ComponentProps<typeof SettingRow>> = {}) => {
  const onChange = vi.fn();
  const onReset = vi.fn();
  render(
    <SettingRow
      ctx={ctx()}
      enabled={true}
      setting={setting(id)}
      tt={tt}
      onChange={onChange}
      onReset={onReset}
      {...props}
    />,
  );
  return { onChange, onReset };
};

describe("SettingRow", () => {
  it("shows a boolean as a switch and reports 0 or 1", async () => {
    const { onChange } = row("taa");
    const toggle = screen.getByRole("checkbox", { name: "label.taa" });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith("0");
  });

  it("offers the catalog's choices with their translated names", async () => {
    const { onChange } = row("shadowResolution");
    const select = screen.getByRole("combobox", { name: "label.shadowResolution" });
    expect(select).toHaveValue("2048");
    await userEvent.selectOptions(select, "4096");
    expect(onChange).toHaveBeenCalledWith("4096");
  });

  it("only reports valid numbers and explains the bounds otherwise", async () => {
    const { onChange } = row("gamma");
    const input = screen.getByRole("textbox", { name: "label.gamma" });
    expect(input).toHaveValue("1");
    await userEvent.clear(input);
    await userEvent.type(input, "9");
    expect(onChange).not.toHaveBeenCalledWith("9");
    expect(screen.getByText(/ui\.invalidRange/)).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, "1,5");
    expect(onChange).toHaveBeenLastCalledWith("1.5");
  });

  it("tints a changed row and lets you undo that one change", async () => {
    const { onReset } = row("gamma", { ctx: ctx({ gamma: "1.5" }) });
    expect(screen.getByTestId("settings-row-gamma").className).toContain("bg-success-weak");
    await userEvent.click(screen.getByTitle("ui.resetOne"));
    expect(onReset).toHaveBeenCalled();
  });

  it("greys out and locks a setting whose dependency is off", () => {
    row("taaSharpen", { enabled: false });
    expect(screen.getByTestId("settings-row-taaSharpen").className).toContain("opacity-50");
    expect(screen.getByRole("textbox", { name: "label.taaSharpen" })).toBeDisabled();
  });
});

describe("SettingRow, valeur existante hors bornes", () => {
  it("does not flag a value already in the INI, only a value the user types", async () => {
    const out: IIniFile[] = [
      { role: "prefs", path: "/x/SkyrimPrefs.ini", text: "[Display]\nfGamma=9.0000\n" },
    ];
    render(
      <SettingRow
        ctx={{ effective: readEffective(out), defaults: new Map(), pending: {} }}
        enabled={true}
        setting={setting("gamma")}
        tt={tt}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect(screen.queryByText(/ui\.invalidRange/)).toBeNull();
    const input = screen.getByRole("textbox", { name: "label.gamma" });
    await userEvent.type(input, "5");
    expect(screen.getByText(/ui\.invalidRange/)).toBeInTheDocument();
  });
});

describe("SettingRow, booléen sans valeur", () => {
  it("shows a switch with no value in the INI as undecided, and turns it on when clicked", async () => {
    const onChange = vi.fn();
    render(
      <SettingRow
        ctx={{ effective: new Map(), defaults: new Map(), pending: {} }}
        enabled={true}
        setting={setting("audioEnabled")}
        tt={tt}
        onChange={onChange}
        onReset={() => undefined}
      />,
    );
    const toggle = screen.getByRole("checkbox", { name: "label.audioEnabled" });
    expect(toggle).toHaveAttribute("aria-checked", "mixed");
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith("1");
  });
});
