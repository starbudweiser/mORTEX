/**
 * Tests for what a table's rows are virtualised against. A table with a sticky header
 * doesn't scroll itself: its main pane has visible overflow and the page scrolls it, so
 * the rows have to be observed against that page scroll, not the pane.
 */
import { render, waitFor } from "@testing-library/react";
import * as PropTypes from "prop-types";
import * as React from "react";
import { Provider } from "react-redux";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import SuperTable from "./Table";
import HeaderCell from "./table/HeaderCell";

// Render the bare table: no store, extension registry or i18n instance to set up.
vi.mock("./ComponentEx", async (importOriginal) => {
  const identity = () => (component: unknown) => component;
  return {
    ...(await importOriginal<object>()),
    connect: identity,
    extend: identity,
    translate: identity,
  };
});

const observedRoots = new Map<Element, Element | null>();

class FakeIntersectionObserver {
  private mRoot: Element | null;
  constructor(_callback: unknown, options: IntersectionObserverInit) {
    this.mRoot = (options.root as Element) ?? null;
  }
  public observe(target: Element) {
    observedRoots.set(target, this.mRoot);
  }
  public unobserve(target: Element) {
    observedRoots.delete(target);
  }
  public disconnect() {
    // nop
  }
}

const state = { settings: { interface: { usage: {} } }, persistent: {} };
const store = { getState: () => state, subscribe: () => () => undefined, dispatch: vi.fn() };

class LegacyContext extends React.Component<{ children: React.ReactNode }> {
  public static childContextTypes = { api: PropTypes.object };
  public getChildContext() {
    return {
      api: {
        events: { on: vi.fn(), emit: vi.fn(), removeAllListeners: vi.fn() },
        getState: () => state,
        store,
      },
    };
  }
  public render() {
    return <Provider store={store as never}>{this.props.children}</Provider>;
  }
}

const attributes = [
  {
    id: "name",
    name: "Name",
    placement: "table",
    calc: (row: { name: string }) => row.name,
    edit: {},
    noShrink: true,
  },
];

const data = { a: { name: "a" }, b: { name: "b" }, c: { name: "c" } };

const Table = SuperTable as React.ComponentType<any>;

function renderTable(stickyHeader: boolean, rows: object = data) {
  // stands in for the page scroll around a sticky-header table
  const page = document.createElement("div");
  page.style.overflowY = "auto";
  const host = document.createElement("div");
  page.appendChild(host);
  document.body.appendChild(page);

  const result = render(
    <LegacyContext>
      <Table
        t={(key: string) => key}
        tableId="test"
        data={rows}
        objects={attributes}
        actions={[]}
        attributeState={{}}
        language="en"
        collapsedGroups={[]}
        hasActions={false}
        showDetails={false}
        stickyHeader={stickyHeader}
        onSetAttributeVisible={vi.fn()}
        onSetAttributeSort={vi.fn()}
        onSetAttributeFilter={vi.fn()}
        onSetGroupingAttribute={vi.fn()}
        onCollapseGroup={vi.fn()}
        onSetCollapsedGroups={vi.fn()}
      />
    </LegacyContext>,
    { container: host },
  );
  const pane = host.querySelector(".table-main-pane");
  return { ...result, page, pane };
}

async function rowsOf(container: HTMLElement): Promise<Element[]> {
  await waitFor(() => expect(container.querySelectorAll("tr[data-rowid]")).toHaveLength(3));
  return Array.from(container.querySelectorAll("tr[data-rowid]"));
}

beforeAll(() => {
  window.IntersectionObserver = FakeIntersectionObserver as any;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("SuperTable row virtualisation", () => {
  it("observes the rows of a sticky-header table against the page scroll", async () => {
    const { container, page, unmount } = renderTable(true);

    for (const row of await rowsOf(container)) {
      expect(observedRoots.get(row)).toBe(page);
    }
    unmount();
  });

  it("observes the rows of any other table against its own pane", async () => {
    const { container, pane, unmount } = renderTable(false);

    for (const row of await rowsOf(container)) {
      expect(observedRoots.get(row)).toBe(pane);
    }
    unmount();
  });

  it("keeps noShrink columns from shrinking while the page scrolls, until unmounted", async () => {
    const updateWidth = vi.spyOn(HeaderCell.prototype, "updateWidth");
    const { container, page, unmount } = renderTable(true);
    await rowsOf(container);

    page.dispatchEvent(new Event("scroll"));
    expect(updateWidth).toHaveBeenCalled();

    unmount();
    updateWidth.mockClear();
    page.dispatchEvent(new Event("scroll"));
    expect(updateWidth).not.toHaveBeenCalled();
  });

  it("renders a long list in batches, the rest standing in as a spacer", async () => {
    // the spacer stays far below the view until it is scrolled to
    let spacerTop = 100_000;
    const rect = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        return this.classList.contains("table-rows-spacer")
          ? ({ top: spacerTop, bottom: spacerTop } as DOMRect)
          : rect.call(this);
      },
    );
    const many = Object.fromEntries(
      Array.from({ length: 1000 }, (_v, idx) => [`m${idx}`, { name: `m${idx}` }]),
    );
    const { container, pane, unmount } = renderTable(false, many);

    await waitFor(() => expect(container.querySelectorAll("tr[data-rowid]")).toHaveLength(200));
    expect(container.querySelector(".table-rows-spacer")).not.toBeNull();

    spacerTop = 0;
    pane.dispatchEvent(new Event("scroll"));
    await waitFor(() =>
      expect(container.querySelectorAll("tr[data-rowid]").length).toBeGreaterThan(200),
    );
    unmount();
  });
});
