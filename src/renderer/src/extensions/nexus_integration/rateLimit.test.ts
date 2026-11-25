import { RateLimitError } from "@nexusmods/nexus-api";
import { V3ApiError } from "@vortex/nexus-api-v3";
import { describe, expect, it } from "vitest";

import { isRateLimited } from "./rateLimit";

describe("isRateLimited", () => {
  it("recognises a v1 RateLimitError", () => {
    expect(isRateLimited(new RateLimitError())).toBe(true);
  });

  it("recognises a v3 error that kept a 429", () => {
    expect(isRateLimited(new V3ApiError({ title: "Too Many Requests", status: 429 }))).toBe(true);
  });

  it("recognises an error carrying statusCode 429, as the GraphQL client throws", () => {
    expect(isRateLimited(Object.assign(new Error("429"), { statusCode: 429 }))).toBe(true);
  });

  it("ignores other failures", () => {
    expect(isRateLimited(new V3ApiError({ title: "Server Error", status: 500 }))).toBe(false);
    expect(isRateLimited(Object.assign(new Error("nope"), { statusCode: 404 }))).toBe(false);
    expect(isRateLimited(new Error("network down"))).toBe(false);
    expect(isRateLimited(undefined)).toBe(false);
  });
});
