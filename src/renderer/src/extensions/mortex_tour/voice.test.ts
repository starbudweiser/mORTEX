import * as fs from "fs";
import * as path from "path";

import { describe, expect, it, vi } from "vitest";

vi.mock("../../util/getVortexPath", () => ({ default: () => "" }));

import { STEPS } from "./steps";
import { audioName } from "./voice";

const ROOT = path.resolve(__dirname, "../../../../..");

describe("tour voice", () => {
  it("has a recording for every step in the 4 languages (else: mac/gen_tour_audio.py)", () => {
    for (const lang of ["fr", "en", "es", "it"]) {
      const table = JSON.parse(
        fs.readFileSync(path.join(ROOT, "locales", lang, "common.json"), "utf8"),
      );
      for (const step of STEPS) {
        // l'appli remplace « Vortex » par « mORTEX » à l'affichage : la voix ne correspondrait plus
        expect(`${table[step.title]} ${table[step.text]}`).not.toMatch(/Vortex/);
        const name = audioName(
          lang,
          table[step.title] ?? step.title,
          table[step.text] ?? step.text,
        );
        expect(
          fs.existsSync(path.join(ROOT, "assets/tour", `${name}.m4a`)),
          `${lang} ${step.id}`,
        ).toBe(true);
      }
    }
  });
});
