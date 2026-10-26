/**
 * Installs that don't come from a download (files dropped or picked from disk) carry neither an
 * archive id nor a source mod. Their tracking key used to be "undefined:undefined" for all of
 * them, so starting several at once made them overwrite each other's tracking and all but the
 * first failed with "Installation tracking lost". Driven through the REAL InstallManager.
 */
import { describe, expect, vi } from "vitest";

import { test as imTest } from "../../test-utils/installManagerTest";

vi.mock("../../util/log", () => {
  const log = vi.fn();
  return { default: log, log };
});

describe("InstallManager direct installs", () => {
  imTest("tracks each concurrent install separately", ({ makeInstallManager }) => {
    const h = makeInstallManager({ mods: { skyrimse: {} } });
    const active = (h.manager as unknown as { mActiveInstalls: Map<string, unknown> })
      .mActiveInstalls;

    for (const name of ["a.zip", "b.7z", "c.zip"]) {
      h.manager.install(
        undefined as unknown as string,
        `/archives/${name}`,
        ["skyrimse"],
        h.api,
        {},
        false,
        false,
        () => undefined,
      );
    }

    expect(active.size).toBe(3);
  });
});
