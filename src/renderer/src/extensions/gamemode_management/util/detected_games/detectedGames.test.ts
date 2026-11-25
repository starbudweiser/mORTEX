import { describe, expect, it, vi } from "vitest";

import { requestDetectedGames } from "./detectedGames";

const makeApi = (failed = false) => {
  const dispatch = vi.fn();
  const api = {
    getState: () => ({
      session: { gameMode: { detectedGamesStatus: failed ? "failed" : undefined } },
    }),
    store: { dispatch },
  };

  return { api, dispatch };
};

/** The status updates dispatched, in order. */
const statuses = (dispatch: ReturnType<typeof vi.fn>) =>
  (dispatch.mock.calls as Array<[{ type: string; payload: unknown }]>)
    .map(([action]) => action)
    .filter((action) => action.type === "SET_DETECTED_GAMES_STATUS")
    .map((action) => action.payload);

describe("requestDetectedGames", () => {
  it("makes no request and records no status when nothing failed before", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { api, dispatch } = makeApi();

    await requestDetectedGames(api as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("clears a failure recorded by an earlier build", async () => {
    const { api, dispatch } = makeApi(true);

    await requestDetectedGames(api as never);

    expect(statuses(dispatch)).toEqual([undefined]);
  });

  it("resolves even when forced, as after a scan", async () => {
    const { api } = makeApi();

    await expect(requestDetectedGames(api as never, { force: true })).resolves.toBeUndefined();
  });
});
