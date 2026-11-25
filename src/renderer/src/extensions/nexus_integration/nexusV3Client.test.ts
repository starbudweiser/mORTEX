import { V3ApiError } from "@vortex/nexus-api-v3";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { IExtensionApi } from "@/types/IExtensionContext";

import { createVortexNexusV3Client } from "./nexusV3Client";
import { getAccessToken } from "./util/oauthSession";
import { retryAfterMs } from "./util/rateLimitWait";

vi.mock("../../util/application", () => ({ getApplication: () => ({ version: "0.0.0-test" }) }));
vi.mock("./util/oauthSession", () => ({ getAccessToken: vi.fn() }));

const getToken = vi.mocked(getAccessToken);

function makeApi(stateToken: string | undefined): IExtensionApi {
  const nexus =
    stateToken === undefined
      ? {}
      : { OAuthCredentials: { token: stateToken, refreshToken: "refresh", fingerprint: "fp" } };
  return { getState: () => ({ confidential: { account: { nexus } } }) } as unknown as IExtensionApi;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ok = () => json({ data: { mods: [] } }, 200);
const unauthorized = () => json({ title: "Unauthorized", status: 401 }, 401);

const fetchMock = vi.fn<typeof globalThis.fetch>();

/** The Request openapi-fetch handed to fetch on the nth call. */
function sentRequest(n: number): Request {
  const call = fetchMock.mock.calls[n];
  if (call === undefined) throw new Error(`fetch was not called ${n + 1} times`);
  return call[0] as Request;
}

beforeEach(() => {
  fetchMock.mockReset();
  getToken.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createVortexNexusV3Client oauth", () => {
  test("sends the token the session hands out rather than the one in state", async () => {
    getToken.mockResolvedValue("fresh");
    fetchMock.mockResolvedValueOnce(ok());

    const api = makeApi("stale");
    await createVortexNexusV3Client(api).getModsBatch(["1"]);

    expect(getToken).toHaveBeenCalledWith(api, undefined);
    expect(sentRequest(0).headers.get("Authorization")).toBe("Bearer fresh");
  });

  test("retries a 401 once with a forced refresh of the rejected token", async () => {
    getToken.mockResolvedValueOnce("expired").mockResolvedValueOnce("renewed");
    fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(ok());

    const api = makeApi("expired");
    const result = await createVortexNexusV3Client(api).getModsBatch(["1", "2"]);

    expect(result).toEqual([]);
    expect(getToken).toHaveBeenNthCalledWith(2, api, "expired");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentRequest(1).headers.get("Authorization")).toBe("Bearer renewed");
    // the retry carries the original body
    await expect(sentRequest(1).text()).resolves.toEqual(await sentRequest(0).text());
  });

  test("lets the 401 through when the refresh yields the same token", async () => {
    getToken.mockResolvedValue("dead");
    fetchMock.mockResolvedValueOnce(unauthorized());

    const pending = createVortexNexusV3Client(makeApi("dead")).getModsBatch(["1"]);

    await expect(pending).rejects.toBeInstanceOf(V3ApiError);
    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("lets the 401 through when the refresh is refused", async () => {
    getToken.mockResolvedValueOnce("dead").mockRejectedValueOnce(new Error("invalid_grant"));
    fetchMock.mockResolvedValueOnce(unauthorized());

    const pending = createVortexNexusV3Client(makeApi("dead")).getModsBatch(["1"]);

    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("does not retry a 401 for an anonymous request", async () => {
    getToken.mockResolvedValue(undefined);
    fetchMock.mockResolvedValueOnce(unauthorized());

    const pending = createVortexNexusV3Client(makeApi(undefined)).getModsBatch(["1"]);

    await expect(pending).rejects.toMatchObject({ status: 401 });
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(sentRequest(0).headers.has("Authorization")).toBe(false);
  });
});

describe("createVortexNexusV3Client identification", () => {
  test("identifies the application as mORTEX on every request", async () => {
    getToken.mockResolvedValue(undefined);
    fetchMock.mockResolvedValueOnce(ok());

    await createVortexNexusV3Client(makeApi(undefined)).getModsBatch(["1"]);

    const headers = sentRequest(0).headers;
    expect(headers.get("Application-Name")).toBe("mORTEX");
    expect(headers.get("Application-Version")).toBe("0.0.0-test");
    expect(headers.get("User-Agent")).toBe("mORTEX/0.0.0-test");
  });
});

describe("createVortexNexusV3Client rate limit", () => {
  const tooManyRequests = (retryAfter?: string) =>
    new Response(JSON.stringify({ title: "Too Many Requests", status: 429 }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...(retryAfter === undefined ? {} : { "Retry-After": retryAfter }),
      },
    });

  beforeEach(() => {
    vi.useFakeTimers();
    getToken.mockResolvedValue("token");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("waits as long as Retry-After says, then sends the request again", async () => {
    fetchMock.mockResolvedValueOnce(tooManyRequests("3")).mockResolvedValueOnce(ok());

    const pending = createVortexNexusV3Client(makeApi("token")).getModsBatch(["1"]);

    await vi.advanceTimersByTimeAsync(2_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // the retry carries the credentials and the body of the original request
    expect(sentRequest(1).headers.get("Authorization")).toBe("Bearer token");
    await expect(sentRequest(1).text()).resolves.toEqual(await sentRequest(0).text());
  });

  test("gives up after two retries and lets the 429 through", async () => {
    fetchMock
      .mockResolvedValueOnce(tooManyRequests())
      .mockResolvedValueOnce(tooManyRequests())
      .mockResolvedValueOnce(tooManyRequests());

    const pending = createVortexNexusV3Client(makeApi("token")).getModsBatch(["1"]);
    const settled = expect(pending).rejects.toMatchObject({ status: 429 });

    // 2 s, then 4 s, when the response names no delay
    await vi.advanceTimersByTimeAsync(6_000);
    await settled;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test("never waits longer than thirty seconds", async () => {
    fetchMock.mockResolvedValueOnce(tooManyRequests("3600")).mockResolvedValueOnce(ok());

    const pending = createVortexNexusV3Client(makeApi("token")).getModsBatch(["1"]);

    await vi.advanceTimersByTimeAsync(30_000);
    await expect(pending).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("leaves other statuses alone", async () => {
    fetchMock.mockResolvedValueOnce(json({ title: "Server Error", status: 500 }, 500));

    const pending = createVortexNexusV3Client(makeApi("token")).getModsBatch(["1"]);

    await expect(pending).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("retryAfterMs", () => {
  const withHeader = (value?: string) =>
    new Response(null, {
      status: 429,
      headers: value === undefined ? {} : { "Retry-After": value },
    });

  test("reads seconds", () => {
    expect(retryAfterMs(withHeader("7"))).toBe(7_000);
  });

  test("reads an HTTP date relative to now", () => {
    const now = Date.parse("2026-11-25T12:00:00Z");
    expect(retryAfterMs(withHeader("Wed, 25 Nov 2026 12:00:10 GMT"), now)).toBe(10_000);
  });

  test("is undefined when the header is missing or unreadable", () => {
    expect(retryAfterMs(withHeader())).toBeUndefined();
    expect(retryAfterMs(withHeader("soon"))).toBeUndefined();
  });
});
