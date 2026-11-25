import type { IExtensionApi } from "@/types/IExtensionContext";

import { setDetectedGamesStatus } from "../../actions/session";

export interface IRequestDetectedGamesOptions {
  /** Kept for the callers that force a refresh after a scan; there is no request to force. */
  force?: boolean;
}

/**
 * mORTEX does not ask Nexus Mods which games are installed.
 *
 * Vortex sent the store listings found on the machine (Steam, GOG and Epic ids), an instance id
 * and its version to the `/v3/vortex/detected-games` endpoint, an integration internal to Vortex
 * that third-party applications are not authorised to use. Nothing is sent here: the games on this
 * Mac are found by the game extensions' own discovery, and `session.gameMode.detectedGames` stays
 * empty. A failure recorded by an earlier build is cleared, since nothing can fail any more.
 *
 * Never rejects.
 */
export function requestDetectedGames(
  api: IExtensionApi,
  _options: IRequestDetectedGamesOptions = {},
): Promise<void> {
  if (api.getState().session?.gameMode?.detectedGamesStatus !== undefined) {
    api.store.dispatch(setDetectedGamesStatus(undefined));
  }
  return Promise.resolve();
}

/** Nothing is cached any more, so there is nothing to reset. Kept for the login hook. */
export function resetDetectedGamesHash(): void {
  // intentionally empty
}
