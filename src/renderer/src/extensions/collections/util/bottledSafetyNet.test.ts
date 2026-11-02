import { describe, expect, it } from "vitest";

import { findFeatureDuplicates } from "./bottledSafetyNet";

const bottled = [
  "SKSE/Plugins/CommunityShaders.dll",
  "Shaders/Features/GrassCollision.ini",
  "Shaders/Features/Foo.ini",
  "Shaders/GrassCollision/GrassCollision.hlsli",
  "Shaders/Foo/Foo.hlsl",
];

describe("findFeatureDuplicates", () => {
  it("flags a mod whose shader files Bottled Shaders already provides, ignoring case and slashes", () => {
    expect(
      findFeatureDuplicates(bottled, [
        {
          id: "grass",
          files: [
            "shaders\\features\\grasscollision.ini",
            "Shaders/GrassCollision/GrassCollision.hlsli",
            "readme.txt",
          ],
        },
      ]),
    ).toEqual(["grass"]);
  });

  it("keeps a mod that has a shader file Bottled does not have", () => {
    expect(
      findFeatureDuplicates(bottled, [
        {
          id: "newer",
          files: ["Shaders/Features/Foo.ini", "Shaders/Foo/Foo.hlsl", "Shaders/Foo/Extra.hlsl"],
        },
      ]),
    ).toEqual([]);
  });

  it("keeps a mod that is not a shader feature", () => {
    expect(
      findFeatureDuplicates(bottled, [
        { id: "textures", files: ["Textures/a.dds"] },
        { id: "helper", files: ["Shaders/Foo/Foo.hlsl"] },
      ]),
    ).toEqual([]);
  });
});
