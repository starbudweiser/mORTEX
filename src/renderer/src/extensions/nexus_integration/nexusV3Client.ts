import {
  createNexusV3Client,
  type NexusV3Client,
  type NexusV3ClientOptions,
  type NexusV3Middleware,
} from "@vortex/nexus-api-v3";

import type { IExtensionApi } from "../../types/IExtensionContext";
import { getApplication } from "../../util/application";
import { APPLICATION_NAME, NEXUS_API_URL } from "./constants";
import { hasConfidentialWithNexus } from "./guards";
import { getOAuthTokenFromState } from "./util";
import { getAccessToken } from "./util/oauthSession";
import { RATE_LIMIT_RETRIES, rateLimitWaitMs, sleep } from "./util/rateLimitWait";

export type VortexNexusV3ClientOptions = Omit<
  NexusV3ClientOptions,
  "baseUrl" | "userAgent" | "applicationName" | "applicationVersion"
>;

const NEXUS_V3_API_URL = `${NEXUS_API_URL}/v3`;

/**
 * Bearer auth that outlives the token the client was built with: the session refreshes the OAuth
 * token ahead of expiry, so resolve it per request rather than once at creation, and retry a 401
 * once with a forced refresh, as nexus-api does for its own requests.
 */
function oauthMiddleware(api: IExtensionApi): NexusV3Middleware {
  // The first fetch consumes the body, so a retry needs a clone taken beforehand.
  const inflight = new Map<string, { retry: Request; token: string | undefined }>();

  const getToken = (rejectedToken?: string) => getAccessToken(api, rejectedToken);

  return {
    async onRequest({ id, request }) {
      const token = await getToken();
      if (token !== undefined) {
        request.headers.set("Authorization", `Bearer ${token}`);
      }
      inflight.set(id, { retry: request.clone(), token });
    },
    async onResponse({ id, response, options }) {
      const sent = inflight.get(id);
      inflight.delete(id);
      if (response.status !== 401 || sent?.token === undefined) {
        return undefined;
      }
      let fresh: string | undefined;
      try {
        fresh = await getToken(sent.token);
      } catch {
        // the refresh was refused, so the 401 stands and the caller decides
        return undefined;
      }
      if (fresh === undefined || fresh === sent.token) {
        return undefined;
      }
      sent.retry.headers.set("Authorization", `Bearer ${fresh}`);
      return options.fetch(sent.retry);
    },
    onError({ id }) {
      inflight.delete(id);
    },
  };
}

/**
 * Honours Nexus Mods' rate limit: a 429 is sent again after the delay `Retry-After` names (a
 * growing one when it names none), up to `RATE_LIMIT_RETRIES` times, never faster than the site
 * asks. When it is still 429 after that, the response is returned and the caller reports it.
 * Registered last so the copy kept for the retry already carries the other middleware's headers.
 */
function rateLimitMiddleware(): NexusV3Middleware {
  const inflight = new Map<string, Request>();

  return {
    onRequest({ id, request }) {
      inflight.set(id, request.clone());
    },
    async onResponse({ id, response, options }) {
      const sent = inflight.get(id);
      inflight.delete(id);
      if (sent === undefined || response.status !== 429) return undefined;

      let current = response;
      for (let attempt = 0; attempt < RATE_LIMIT_RETRIES && current.status === 429; attempt++) {
        await sleep(rateLimitWaitMs(current, attempt), sent.signal);
        if (sent.signal.aborted) break;
        current = await options.fetch(sent.clone());
      }
      return current === response ? undefined : current;
    },
    onError({ id }) {
      inflight.delete(id);
    },
  };
}

/** Resolve mORTEX's credentials, base URL and identification into client options. */
function vortexV3Options(
  api: IExtensionApi,
  options: VortexNexusV3ClientOptions,
): NexusV3ClientOptions {
  const { confidential } = api.getState();
  const apiKey = hasConfidentialWithNexus(confidential)
    ? confidential.account.nexus?.APIKey
    : undefined;

  return {
    bearerToken: getOAuthTokenFromState(api),
    apiKey,
    ...options,
    middleware: [oauthMiddleware(api), rateLimitMiddleware(), ...(options.middleware ?? [])],
    baseUrl: NEXUS_V3_API_URL,
    userAgent: `${APPLICATION_NAME}/${getApplication().version}`,
    applicationName: APPLICATION_NAME,
    applicationVersion: getApplication().version,
  };
}

/**
 * Creates a Nexus v3 API client pre-configured for mORTEX.
 * Credentials can still be overridden via `options`.
 */
export function createVortexNexusV3Client(
  api: IExtensionApi,
  options: VortexNexusV3ClientOptions = {},
): NexusV3Client {
  return createNexusV3Client(vortexV3Options(api, options));
}
