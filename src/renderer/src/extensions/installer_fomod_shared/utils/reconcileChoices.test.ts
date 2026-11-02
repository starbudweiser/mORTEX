import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";

import iconv from "iconv-lite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../util/log", () => ({ log: vi.fn() }));

import type { IChoices } from "../types/interface";
import type { IStepStructure } from "./reconcileChoices";
import {
  adaptChoicesToInstaller,
  nameScore,
  parseStructure,
  reconcileChoices,
} from "./reconcileChoices";

// what the FOMOD engine does with a recorded preset: a step, group and option is selected when
// the preset has a step, group and choice of exactly that name (names are not unique, so every
// entry of that name counts)
function selectedByEngine(choices: IChoices, structure: IStepStructure[]) {
  const selected: Record<string, string[]> = {};
  structure.forEach((step) =>
    step.groups.forEach((group) => {
      const presetGroups = (choices ?? [])
        .filter((s) => s.name === step.name)
        .flatMap((s) => s.groups.filter((g) => g.name === group.name));
      const names = presetGroups.flatMap((g) => g.choices.map((c) => c.name));
      selected[`${step.name} / ${group.name}`] = group.options.filter((o) => names.includes(o));
    }),
  );
  return selected;
}

// "V.E.F AIO Patch Hub" as the collection records it for 2.02 (Skyrim ULTIMATE | 2025 AE)
const recorded202: IChoices = [
  {
    name: "Custom Races",
    groups: [
      { name: "Custom Races", choices: [{ name: "None", idx: 2 }] },
      { name: "Custom Races", choices: [{ name: "None", idx: 2 }] },
      { name: "Custom Races", choices: [] },
    ],
  },
  {
    name: "Vampire Overhauls",
    groups: [
      {
        name: "Better Vampires (Select Your Installed Version)",
        choices: [{ name: "None", idx: 4 }],
      },
      { name: "Vampire Addons", choices: [{ name: "Sacrilege", idx: 3 }] },
    ],
  },
  {
    name: "Race Compatability",
    groups: [{ name: "Version", choices: [{ name: "None", idx: 2 }] }],
  },
  {
    name: "Race Compatability - Better Vampires",
    groups: [{ name: "Do you use Better Vampires and Race Compatability?", choices: [] }],
  },
  {
    name: "Race Compatability - Scion",
    groups: [{ name: "Do you use Scion and Race Compatability?", choices: [] }],
  },
  {
    name: "Race Compatability - Sacrosanct",
    groups: [{ name: "Do you use Sacrosanct and Race Compatability?", choices: [] }],
  },
];

// the same installer in 2.5 (names as in its ModuleConfig.xml, options shortened)
const yesNo = ["Yes", "No"];
const structure25: IStepStructure[] = [
  {
    name: "Custom Races",
    groups: [
      { name: "Custom Races", options: ["Aetherius Race", "Aetherius Race (Lower)", "None"] },
      { name: "Custom Races", options: ["Nirn's Chosen", "Nirn's Chosen HPH", "None"] },
      { name: "Custom Races", options: ["Amazons of Skyrim", "COTR", "UBE 2.0"] },
    ],
  },
  { name: "Half Dragon Race", groups: [{ name: "Select Your Version", options: ["A", "B"] }] },
  {
    name: "Deep Elf Race Version",
    groups: [
      { name: "Do you have the Deep Elf Race High Poly Head Patch installed?", options: yesNo },
    ],
  },
  { name: "Half Khajiit Version", groups: [{ name: "High Poly Head?", options: yesNo }] },
  {
    name: "Custom Races",
    groups: [{ name: "Lost Races of Nirn", options: ["Ayelid Race", "Dwarf Race"] }],
  },
  {
    name: "Vampire Overhauls",
    groups: [
      {
        name: "Better Vampires (Select Your Installed Version)",
        options: ["8.8", "9.2", "None"],
      },
      { name: "Vampire Addons", options: ["Dynamic Vampire Appearance", "Feral", "Sacrilege"] },
    ],
  },
  {
    name: "Race Compatibility - Better Vampires",
    groups: [{ name: "Do you use Better Vampires and Race Compatibility?", options: yesNo }],
  },
  {
    name: "Race Compatibility Version",
    groups: [
      {
        name: "Version (Select Your Installed Version)",
        options: [
          "Race Compatibility",
          "Race Compatibility (USKPOverride)",
          "Race Compatibility SKSE",
          "None",
        ],
      },
    ],
  },
  {
    name: "Race Compatibility Version (Better Vampires)",
    groups: [
      { name: "Version", options: ["I use RaceCompatibility SKSE", "I use old RaceCompatibility"] },
    ],
  },
  {
    name: "Race Compatibility - Scion",
    groups: [{ name: "Do you use Scion and Race Compatibility?", options: yesNo }],
  },
  {
    name: "Race Compatibility Version (Scion)",
    groups: [
      { name: "Version", options: ["I use RaceCompatibility SKSE", "I use old RaceCompatibility"] },
    ],
  },
  {
    name: "Race Compatibility - Sacrosanct",
    groups: [{ name: "Do you use Sacrosanct and Race Compatibility?", options: yesNo }],
  },
  {
    name: "Race Compatibility Version (Sacrosanct)",
    groups: [
      { name: "Version", options: ["I use RaceCompatibility SKSE", "I use old RaceCompatibility"] },
    ],
  },
];

describe("reconcileChoices", () => {
  it("finds the choice of a step and group renamed since the choices were recorded", () => {
    // before: nothing carries the recorded name, the engine would fall back to the first option
    expect(
      selectedByEngine(recorded202, structure25)[
        "Race Compatibility Version / Version (Select Your Installed Version)"
      ],
    ).toEqual([]);

    const { choices } = reconcileChoices(recorded202, structure25);
    const selected = selectedByEngine(choices, structure25);

    expect(
      selected["Race Compatibility Version / Version (Select Your Installed Version)"],
    ).toEqual(["None"]);
  });

  it("keeps what already matched by name", () => {
    const { choices } = reconcileChoices(recorded202, structure25);
    const before = selectedByEngine(recorded202, structure25);
    const after = selectedByEngine(choices, structure25);

    expect(after["Vampire Overhauls / Vampire Addons"]).toEqual(["Sacrilege"]);
    expect(after["Vampire Overhauls / Better Vampires (Select Your Installed Version)"]).toEqual([
      "None",
    ]);
    expect(after["Custom Races / Lost Races of Nirn"]).toEqual([]);
    Object.keys(before)
      .filter((key) => before[key].length > 0)
      .forEach((key) => expect(after[key]).toEqual(before[key]));
  });

  it("pairs steps that only had a typo fixed, each with its own record", () => {
    const { choices } = reconcileChoices(recorded202, structure25);
    const names = choices?.map((s) => s.name) ?? [];

    expect(names).toContain("Race Compatibility - Better Vampires");
    expect(names).toContain("Race Compatibility - Scion");
    expect(names).toContain("Race Compatibility - Sacrosanct");
    expect(names).toContain("Race Compatibility Version");
    // not mixed up with the lookalike "Version (Scion)" and friends
    expect(names).not.toContain("Race Compatibility Version (Scion)");
  });

  it("does not touch the choices of a version whose names did not change", () => {
    const structure202: IStepStructure[] = [
      structure25[0],
      structure25[5],
      {
        name: "Race Compatability",
        groups: [
          { name: "Version", options: ["Race Compatability", "Race Compatability SKSE", "None"] },
        ],
      },
    ];
    const result = reconcileChoices(recorded202, structure202);

    expect(result.choices).toBe(recorded202);
    expect(result.remaps).toEqual([]);
  });

  it("follows an option renamed inside a group that kept its name", () => {
    const recorded: IChoices = [
      {
        name: "Main",
        groups: [{ name: "Edition", choices: [{ name: "Compatability patch", idx: 1 }] }],
      },
    ];
    const structure: IStepStructure[] = [
      { name: "Main", groups: [{ name: "Edition", options: ["Basic", "Compatibility Patch"] }] },
    ];
    const { choices } = reconcileChoices(recorded, structure);

    expect(selectedByEngine(choices, structure)["Main / Edition"]).toEqual(["Compatibility Patch"]);
    // the recorded entry stays as it was, the current name is added next to it
    expect(choices?.[0].groups).toEqual([
      { name: "Edition", choices: [{ name: "Compatability patch", idx: 1 }] },
      { name: "Edition", choices: [{ name: "Compatibility Patch", idx: 1 }] },
    ]);
  });

  it("drops a choice whose option no longer exists instead of picking another", () => {
    const recorded: IChoices = [
      { name: "Main", groups: [{ name: "Edition", choices: [{ name: "Legacy", idx: 0 }] }] },
    ];
    const structure: IStepStructure[] = [
      { name: "Main", groups: [{ name: "Edition", options: ["Basic", "Full"] }] },
    ];
    const { choices } = reconcileChoices(recorded, structure);

    expect(selectedByEngine(choices, structure)["Main / Edition"]).toEqual([]);
  });

  it("does not guess between equally close steps", () => {
    const recorded: IChoices = [
      { name: "Patch Setup", groups: [{ name: "Pick", choices: [{ name: "B", idx: 1 }] }] },
    ];
    const structure: IStepStructure[] = [
      { name: "Patch Setup (Skyrim)", groups: [{ name: "Pick", options: ["A", "B"] }] },
      { name: "Patch Setup (Enderal)", groups: [{ name: "Pick", options: ["A", "B"] }] },
    ];
    const { choices, remaps } = reconcileChoices(recorded, structure);

    expect(choices).toBe(recorded);
    expect(remaps).toEqual([]);
  });

  it("leaves the choices alone when there is nothing recorded", () => {
    expect(reconcileChoices(undefined, structure25).choices).toBeUndefined();
    expect(reconcileChoices([], structure25).choices).toEqual([]);
  });
});

describe("nameScore", () => {
  it("ignores case, punctuation, accents and typos", () => {
    expect(nameScore("Race Compatability", "race-compatibility")).toBe(1);
    expect(nameScore("Café", "Cafe")).toBe(1);
  });

  it("rates a name contained whole in a longer one by its share", () => {
    expect(nameScore("Version", "Version (Scion)")).toBe(0.5);
    expect(nameScore("Version", "Revision")).toBe(0);
  });

  it("does not stretch short words", () => {
    expect(nameScore("None", "Nine")).toBe(0);
  });
});

const moduleConfig = `<?xml version="1.0" encoding="UTF-8"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <moduleName>Test</moduleName>
  <installSteps order="Explicit">
    <installStep name="Race Compatibility Version">
      <optionalFileGroups order="Explicit">
        <group name="Version (Select Your Installed Version)" type="SelectExactlyOne">
          <plugins order="Explicit">
            <plugin name="Race Compatibility"><description/><typeDescriptor><type name="Optional"/></typeDescriptor></plugin>
            <plugin name="None"><description/><typeDescriptor><type name="Optional"/></typeDescriptor></plugin>
          </plugins>
        </group>
      </optionalFileGroups>
    </installStep>
  </installSteps>
</config>`;

describe("parseStructure", () => {
  it("lists steps, groups and options", async () => {
    expect(await parseStructure(moduleConfig)).toEqual([
      {
        name: "Race Compatibility Version",
        groups: [
          {
            name: "Version (Select Your Installed Version)",
            options: ["Race Compatibility", "None"],
          },
        ],
      },
    ]);
  });

  it("returns undefined for a script that is not a ModuleConfig", async () => {
    expect(await parseStructure("<Script><Dummy/></Script>")).toBeUndefined();
  });
});

describe("adaptChoicesToInstaller", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "fomod-reconcile-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const recorded: IChoices = [
    {
      name: "Race Compatability",
      groups: [{ name: "Version", choices: [{ name: "None", idx: 2 }] }],
    },
  ];

  async function install(file: string, content: string | Buffer) {
    await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
    await writeFile(path.join(dir, file), content);
  }

  it("reads the ModuleConfig.xml of the extracted archive, whatever its encoding", async () => {
    const file = path.join("Vampire Eye Fix Patch Hub", "fomod", "ModuleConfig.xml");
    const utf16 = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      iconv.encode(moduleConfig, "utf-16le"),
    ]);
    await install(file, utf16);

    const adapted = await adaptChoicesToInstaller([file], dir, recorded);

    expect(adapted?.map((s) => s.name)).toContain("Race Compatibility Version");
  });

  it("reads a ModuleConfig.xml saved as UTF-8 with a byte order mark", async () => {
    const file = path.join("fomod", "ModuleConfig.xml");
    await install(
      file,
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(moduleConfig)]),
    );

    const adapted = await adaptChoicesToInstaller([file], dir, recorded);

    expect(adapted?.map((s) => s.name)).toContain("Race Compatibility Version");
  });

  it("returns the choices untouched when there is no readable installer", async () => {
    expect(await adaptChoicesToInstaller(["readme.txt"], dir, recorded)).toBe(recorded);
    expect(await adaptChoicesToInstaller(["fomod/ModuleConfig.xml"], dir, recorded)).toBe(recorded);

    await install("fomod/ModuleConfig.xml", "<<<not xml");
    expect(await adaptChoicesToInstaller(["fomod/ModuleConfig.xml"], dir, recorded)).toBe(recorded);
  });
});
