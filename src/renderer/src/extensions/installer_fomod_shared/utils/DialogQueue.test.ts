import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./helpers", () => ({ hasActiveFomodDialog: () => false }));

import { DialogQueue } from "./DialogQueue";

// une fenêtre FOMOD ne s'ouvre pas par-dessus le navigateur intégré
describe("DialogQueue and the built-in browser", () => {
  afterEach(() => {
    (DialogQueue as any).instance?.destroy();
    (DialogQueue as any).instance = undefined;
  });

  function setup(browserUrl: string | undefined) {
    const state = { session: { browser: { url: browserUrl } } };
    let onBrowser: (prev: unknown, url: unknown) => void = () => undefined;
    const api = {
      getState: () => state,
      onStateChange: (_path: string[], cb: typeof onBrowser) => {
        onBrowser = cb;
      },
    } as any;
    const ui = {
      instanceId: "fomod-1",
      api,
      startDialogImmediate: vi.fn(),
      cancelDialogImmediate: vi.fn(),
    };
    const queue = DialogQueue.getInstance(api);
    queue.enqueueDialog(ui);
    return {
      state,
      ui,
      queue,
      closeBrowser: () => {
        state.session.browser.url = undefined;
        onBrowser("https://example.com", undefined);
      },
    };
  }

  it("waits while the browser is open and starts once it closes", () => {
    const { ui, queue, closeBrowser } = setup("https://www.nexusmods.com/skse");
    queue.processNext();
    expect(ui.startDialogImmediate).not.toHaveBeenCalled();

    closeBrowser();
    expect(ui.startDialogImmediate).toHaveBeenCalledTimes(1);
  });

  it("starts right away when no browser is open", () => {
    const { ui, queue } = setup(undefined);
    queue.processNext();
    expect(ui.startDialogImmediate).toHaveBeenCalledTimes(1);
  });
});
