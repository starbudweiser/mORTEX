import { describe, expect, it } from "vitest";

import * as actions from "../actions/persistent";
import reducer from "./persistent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// the persistent reducer slices the tests exercise. The production reducer is untyped
// (IReducerSpec defaults T to { [key: string]: any }); these entry shapes model just the cached
// fields the tests read back (timestamp + info for collections/revisions, the rating nest written
// by updateSuccessRate, and the pending-vote record).
interface ICacheEntry {
  timestamp?: number;
  info?: {
    name?: string;
    number?: number;
    metadata?: { ratingValue?: string };
    rating?: { average: number; total: number };
  };
}

interface IPendingVoteEntry {
  collectionSlug: string;
  revisionNumber: number;
  time: number;
}

interface PersistentState {
  collections: Record<string, ICacheEntry>;
  revisions: Record<string, ICacheEntry>;
  pendingVotes: Record<string, IPendingVoteEntry>;
  installFailures?: Record<string, Record<string, { status: string }>>;
}

function reduce(
  state: PersistentState,
  actionCreator: { toString(): string },
  payload: unknown,
): PersistentState {
  const key = actionCreator.toString();
  const fn = reducer.reducers[key];
  if (!fn) {
    throw new Error(`No reducer registered for action "${key}"`);
  }
  return fn(state, payload) as PersistentState;
}

function makeState(overrides: Partial<PersistentState> = {}): PersistentState {
  return {
    collections: {},
    revisions: {},
    pendingVotes: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// updateCollectionInfo
// ---------------------------------------------------------------------------

describe("persistent reducer", () => {
  describe("updateCollectionInfo", () => {
    it("stores collection info with timestamp", () => {
      const state = makeState();
      const result = reduce(state, actions.updateCollectionInfo, {
        collectionId: "slug-abc",
        collectionInfo: { name: "Test Collection" },
        timestamp: 1000,
      });

      expect(result.collections["slug-abc"]).toEqual({
        timestamp: 1000,
        info: { name: "Test Collection" },
      });
    });

    it("overwrites existing collection info", () => {
      const state = makeState({
        collections: {
          "slug-abc": { timestamp: 500, info: { name: "Old" } },
        },
      });
      const result = reduce(state, actions.updateCollectionInfo, {
        collectionId: "slug-abc",
        collectionInfo: { name: "New" },
        timestamp: 1000,
      });

      expect(result.collections["slug-abc"].info.name).toBe("New");
      expect(result.collections["slug-abc"].timestamp).toBe(1000);
    });

    it("deletes collection when collectionInfo is undefined", () => {
      const state = makeState({
        collections: {
          "slug-abc": { timestamp: 500, info: { name: "Old" } },
        },
      });
      const result = reduce(state, actions.updateCollectionInfo, {
        collectionId: "slug-abc",
        collectionInfo: undefined,
        timestamp: undefined,
      });

      expect(result.collections["slug-abc"]).toBeUndefined();
    });

    it("is a no-op delete when collection does not exist", () => {
      const state = makeState();
      const result = reduce(state, actions.updateCollectionInfo, {
        collectionId: "nonexistent",
        collectionInfo: undefined,
        timestamp: undefined,
      });

      expect(result.collections["nonexistent"]).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // updateRevisionInfo
  // ---------------------------------------------------------------------------

  describe("updateRevisionInfo", () => {
    it("stores revision info with timestamp", () => {
      const state = makeState();
      const result = reduce(state, actions.updateRevisionInfo, {
        revisionId: 42,
        revisionInfo: { number: 3 },
        timestamp: 2000,
      });

      expect(result.revisions[42]).toEqual({
        timestamp: 2000,
        info: { number: 3 },
      });
    });

    it("overwrites existing revision info", () => {
      const state = makeState({
        revisions: {
          42: { timestamp: 500, info: { number: 1 } },
        },
      });
      const result = reduce(state, actions.updateRevisionInfo, {
        revisionId: 42,
        revisionInfo: { number: 3 },
        timestamp: 2000,
      });

      expect(result.revisions[42].info.number).toBe(3);
    });

    it("deletes revision when revisionInfo is undefined", () => {
      const state = makeState({
        revisions: {
          42: { timestamp: 500, info: { number: 1 } },
        },
      });
      const result = reduce(state, actions.updateRevisionInfo, {
        revisionId: 42,
        revisionInfo: undefined,
        timestamp: undefined,
      });

      expect(result.revisions[42]).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // updateSuccessRate
  // ---------------------------------------------------------------------------

  describe("updateSuccessRate", () => {
    it("sets vote and rating on a revision", () => {
      const state = makeState({
        revisions: {
          42: { timestamp: 1000, info: {} },
        },
      });
      const result = reduce(state, actions.updateSuccessRate, {
        revisionId: 42,
        vote: "positive",
        average: 0.85,
        total: 100,
      });

      expect(result.revisions[42].info.metadata.ratingValue).toBe("positive");
      expect(result.revisions[42].info.rating).toEqual({
        average: 0.85,
        total: 100,
      });
    });

    it("creates nested structure when revision info is empty", () => {
      const state = makeState({
        revisions: {
          42: { timestamp: 1000, info: {} },
        },
      });
      const result = reduce(state, actions.updateSuccessRate, {
        revisionId: 42,
        vote: "negative",
        average: 0.3,
        total: 10,
      });

      expect(result.revisions[42].info.metadata.ratingValue).toBe("negative");
    });
  });

  // ---------------------------------------------------------------------------
  // setPendingVote
  // ---------------------------------------------------------------------------

  describe("setPendingVote", () => {
    it("stores a pending vote with metadata", () => {
      const state = makeState();
      const result = reduce(state, actions.setPendingVote, {
        revisionId: 42,
        collectionSlug: "my-collection",
        revisionNumber: 3,
        time: 9999,
      });

      expect(result.pendingVotes[42]).toEqual({
        collectionSlug: "my-collection",
        revisionNumber: 3,
        time: 9999,
      });
    });

    it("overwrites an existing pending vote", () => {
      const state = makeState({
        pendingVotes: {
          42: { collectionSlug: "old", revisionNumber: 1, time: 100 },
        },
      });
      const result = reduce(state, actions.setPendingVote, {
        revisionId: 42,
        collectionSlug: "new",
        revisionNumber: 2,
        time: 200,
      });

      expect(result.pendingVotes[42].collectionSlug).toBe("new");
    });
  });

  // ---------------------------------------------------------------------------
  // clearPendingVote
  // ---------------------------------------------------------------------------

  describe("clearPendingVote", () => {
    it("removes a pending vote", () => {
      const state = makeState({
        pendingVotes: {
          42: { collectionSlug: "test", revisionNumber: 1, time: 100 },
        },
      });
      const result = reduce(state, actions.clearPendingVote, {
        revisionId: 42,
      });

      expect(result.pendingVotes[42]).toBeUndefined();
    });

    it("is a no-op when vote does not exist", () => {
      const state = makeState();
      const result = reduce(state, actions.clearPendingVote, {
        revisionId: 99,
      });

      expect(result.pendingVotes[99]).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // defaults
  // ---------------------------------------------------------------------------

  describe("defaults", () => {
    it("provides valid initial state", () => {
      expect(reducer.defaults).toEqual({
        collections: {},
        revisions: {},
        pendingVotes: {},
        installFailures: {},
      });
    });
  });

  // ---------------------------------------------------------------------------
  // setCollectionFailures
  // ---------------------------------------------------------------------------

  describe("setCollectionFailures", () => {
    const failed = { "rule-1": { status: "failed" } };

    it("keeps the failures of a collection's last install", () => {
      const result = reduce(makeState(), actions.setCollectionFailures, {
        collectionId: "coll-1",
        failures: failed,
      });
      expect(result.installFailures).toEqual({ "coll-1": failed });
    });

    it("replaces earlier failures and leaves other collections alone", () => {
      const state = makeState({
        installFailures: { "coll-1": failed, "coll-2": failed },
      });
      const later = { "rule-2": { status: "failed" } };
      const result = reduce(state, actions.setCollectionFailures, {
        collectionId: "coll-1",
        failures: later,
      });
      expect(result.installFailures).toEqual({ "coll-1": later, "coll-2": failed });
    });

    it("clears them once an install ends without failure", () => {
      const state = makeState({ installFailures: { "coll-1": failed } });
      const result = reduce(state, actions.setCollectionFailures, {
        collectionId: "coll-1",
        failures: {},
      });
      expect(result.installFailures).toEqual({});
    });

    it("returns the same state when there is nothing to clear", () => {
      const state = makeState();
      expect(
        reduce(state, actions.setCollectionFailures, { collectionId: "coll-1", failures: {} }),
      ).toBe(state);
    });
  });
});
