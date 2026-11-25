/**
 * Waiting out Nexus Mods' rate limit: how long a 429 asks us to hold off, and a wait that stops
 * when the request is cancelled. Shared by every client that talks to the API, so they all slow
 * down the same way.
 */

/** How many times a request turned away with a 429 is sent again before the 429 is returned. */
export const RATE_LIMIT_RETRIES = 2;
/** Wait when the 429 names no delay, doubled on each retry. */
const RATE_LIMIT_DEFAULT_WAIT_MS = 2_000;
/** Longest wait honoured: a longer `Retry-After` is the caller's to handle, not worth freezing for. */
const RATE_LIMIT_MAX_WAIT_MS = 30_000;

/** The delay a 429 asks for in `Retry-After` (seconds, or an HTTP date), if it names one. */
export function retryAfterMs(response: Response, now: number = Date.now()): number | undefined {
  const header = response.headers.get("Retry-After");
  if (header === null || header.trim().length === 0) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

/** How long to wait before retry number `attempt` (from 0): what the response asks, else a growing delay. */
export function rateLimitWaitMs(response: Response, attempt: number): number {
  return Math.min(
    retryAfterMs(response) ?? RATE_LIMIT_DEFAULT_WAIT_MS * 2 ** attempt,
    RATE_LIMIT_MAX_WAIT_MS,
  );
}

/** Resolves after `ms`, or as soon as `signal` aborts. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}
