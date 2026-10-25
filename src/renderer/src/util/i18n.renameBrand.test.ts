import { describe, expect, it } from "vitest";

import { renameBrand } from "./i18n";

describe("renameBrand", () => {
  it("renames the app in nested values and returns only what changed", () => {
    expect(
      renameBrand({
        browse: { soon: { description: "Bientôt directement dans Vortex.", title: "Titre" } },
        plain: "Rien à changer",
      }),
    ).toEqual({ browse: { soon: { description: "Bientôt directement dans mORTEX." } } });
  });

  it("renames the app written as a common noun", () => {
    expect(renameBrand({ a: "Le vortex peut sembler figé." })).toEqual({
      a: "mORTEX peut sembler figé.",
    });
  });

  it("leaves paths and longer words alone", () => {
    expect(
      renameBrand({ a: "Dossier ~/Library/Application Support/Vortex/", b: "VortexStaging" }),
    ).toBeUndefined();
  });
});
