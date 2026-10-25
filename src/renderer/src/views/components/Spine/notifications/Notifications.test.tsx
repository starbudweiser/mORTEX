import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { INotification, NotificationType } from "@/types/INotification";

const mocks = vi.hoisted(() => ({
  items: [] as INotification[],
  notifications: [] as INotification[],
}));

vi.mock("react-redux", () => ({
  useSelector: () => mocks.notifications,
  useDispatch: () => vi.fn(),
}));

vi.mock("@/ExtensionProvider", () => ({
  useExtensionContext: () => ({ getApi: () => ({ events: { emit: vi.fn() } }) }),
}));

// The panel's contents are unchanged by this ticket and pull in a debouncer and the
// redux store; the trigger is what moved, so the panel hooks are stubbed to empty.
vi.mock("./hooks/useNotificationFiltering.hook", () => ({ useNotificationFiltering: () => [] }));
vi.mock("./hooks/useNotificationItems.hook", () => ({
  useNotificationItems: () => ({ items: mocks.items, collapsed: {} }),
}));

// The panel's rows are someone else's tests; the beak is what this file cares about.
vi.mock("./components/NotificationItem", () => ({ NotificationItem: () => null }));
vi.mock("./hooks/useNotificationActions.hook", () => ({
  useNotificationActions: () => ({
    dismissAll: vi.fn(),
    suppress: vi.fn(),
    triggerAction: vi.fn(),
  }),
}));

import { Notifications, pipSeverity, STARTUP_QUIET_MS } from "./Notifications";

// --- Helpers ---

let nextId = 0;
const notification = (type: NotificationType): INotification => ({
  id: `n${nextId++}`,
  type,
  message: `a ${type}`,
});

/**
 * Somewhere outside the component for focus to already be — the table filter or search
 * box the user is typing in when a notification lands.
 */
const focusElsewhere = (tag: "button" | "input" | "textarea") => {
  const element = document.createElement(tag);
  element.dataset.focusStandIn = "true";
  document.body.append(element);
  element.focus();

  return element;
};

/** Lets the startup's quiet spell pass, after which new notifications open the tray again. */
const passStartup = () => vi.setSystemTime(Date.now() + STARTUP_QUIET_MS + 1);

/** Mounts the bell with nothing waiting, then has the notifications arrive after startup. */
const renderComponent = (types: NotificationType[]) => {
  mocks.notifications = [];
  const { container, rerender } = render(<Notifications />);
  passStartup();
  mocks.notifications = types.map(notification);
  rerender(<Notifications />);

  return {
    container,
    bell: within(container).getByRole("button", { name: "Notifications" }),
    pip: () => within(container).queryByTestId("notification-pip"),
  };
};

beforeEach(() => {
  // only the clock: the tray's quiet spell at startup reads it, userEvent needs real timers
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.clearAllMocks();
  mocks.items = [];
  mocks.notifications = [];
  document.querySelectorAll("[data-focus-stand-in]").forEach((node) => node.remove());
});

afterEach(() => {
  vi.useRealTimers();
});

// --- Tests ---

describe("pipSeverity", () => {
  it("returns nothing when there is nothing waiting", () => {
    expect(pipSeverity([])).toBeUndefined();
  });

  it("ignores silent notifications, which the user never sees", () => {
    expect(pipSeverity([notification("silent")])).toBeUndefined();
  });

  it.each<[NotificationType, string]>([
    ["error", "error"],
    ["warning", "warning"],
    ["info", "info"],
    ["success", "info"],
    ["activity", "info"],
    ["global", "info"],
  ])("maps a lone %s notification to the %s pip", (type, expected) => {
    expect(pipSeverity([notification(type)])).toBe(expected);
  });

  it("lets a single error outrank a pile of warnings", () => {
    const types: NotificationType[] = ["warning", "warning", "error", "warning"];
    expect(pipSeverity(types.map(notification))).toBe("error");
  });

  it("lets a warning outrank info and success", () => {
    const types: NotificationType[] = ["info", "success", "warning"];
    expect(pipSeverity(types.map(notification))).toBe("warning");
  });

  it("ranks by severity, not by which arrived last", () => {
    const types: NotificationType[] = ["error", "info"];
    expect(pipSeverity(types.map(notification))).toBe("error");
  });
});

describe("Notifications trigger", () => {
  it("shows no pip and disables the bell when there is nothing waiting", () => {
    const { bell, pip } = renderComponent([]);
    expect(pip()).toBeNull();
    expect(bell).toBeDisabled();
  });

  it("stays disabled when the only notification is silent", () => {
    const { bell, pip } = renderComponent(["silent"]);
    expect(pip()).toBeNull();
    expect(bell).toBeDisabled();
  });

  it.each<[NotificationType, string]>([
    ["error", "bg-danger-moderate"],
    ["warning", "bg-warning-moderate"],
    ["info", "bg-info-moderate"],
  ])("colours the pip for a %s notification", (type, expectedClass) => {
    const { pip } = renderComponent([type]);
    expect(pip()).toHaveClass(expectedClass);
  });

  it("enables the bell once something is waiting", () => {
    const { bell } = renderComponent(["info"]);
    expect(bell).toBeEnabled();
  });

  it("renders as a spine button, matching its download-button sibling", () => {
    const { bell } = renderComponent(["info"]);
    expect(bell).toHaveClass("size-12", "rounded-full", "border-2");
  });

  it("marks itself active while the tray is open", () => {
    // The tray auto-opens when notifications arrive, so rendering with one is enough.
    const { bell } = renderComponent(["info"]);
    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(bell).toHaveClass("border-neutral-strong");
  });

  it.each<NotificationType>(["activity", "silent"])(
    "does not open itself for a %s notification",
    (type) => {
      // Switching game sends an activity notification while it sets the game up. Progress
      // belongs in the tray for whoever opens it, not thrown in front of them.
      const { bell } = renderComponent([type]);
      expect(bell).toHaveAttribute("aria-expanded", "false");
    },
  );

  it("still opens itself for something worth reading", () => {
    const { bell } = renderComponent(["error"]);
    expect(bell).toHaveAttribute("aria-expanded", "true");
  });

  it.each<"input" | "textarea">(["input", "textarea"])(
    "opens itself without taking focus from a %s the user is in",
    (tag) => {
      // LAZ-1065: the tray coming up on its own used to focus the bell, costing the user
      // their place mid-sentence.
      const field = focusElsewhere(tag);
      const { bell } = renderComponent(["error"]);

      expect(bell).toHaveAttribute("aria-expanded", "true");
      expect(document.activeElement).toBe(field);
    },
  );

  it("takes focus when the user opens it themselves", async () => {
    // Only the auto-open leaves focus alone; a click on the bell is the user asking for
    // it, and the panel is reachable from the keyboard afterwards.
    focusElsewhere("input");
    const { bell } = renderComponent(["activity"]);

    await userEvent.click(bell);

    expect(bell).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(bell);
  });

  it("stays shut for what arrives at startup, leaving the pip to show it", () => {
    // mORTEX: startup's burst of warnings (SKSE missing, downloads to repair) waits in the
    // tray rather than covering the list the user opened the app for.
    mocks.notifications = [notification("error"), notification("warning")];
    render(<Notifications />);

    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(bell).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("notification-pip")).toBeInTheDocument();
  });

  it("closes itself once the last notification has gone", async () => {
    // Switching game fires a burst of notifications that expire on their own. The tray
    // auto-opens for them, and an open tray with nothing in it is just a lit bell.
    mocks.notifications = [];
    const { rerender } = render(<Notifications />);
    passStartup();
    mocks.notifications = [notification("info")];
    rerender(<Notifications />);
    const bell = screen.getByRole("button", { name: "Notifications" });
    expect(bell).toHaveAttribute("aria-expanded", "true");

    mocks.notifications = [];
    rerender(<Notifications />);

    await waitFor(() => {
      expect(bell).toHaveAttribute("aria-expanded", "false");
    });
  });

  it("is not marked active while the tray is closed", () => {
    renderComponent([]);
    // The resting border is transparent — it only paints on hover or while open.
    expect(screen.getByRole("button", { name: "Notifications" })).toHaveClass("border-transparent");
  });
});

// LAZ-999: the tray sits directly above the download flyout in the spine, so the two
// have to read as the same kind of panel — same beak, same distance from their button.
describe("Notifications beak", () => {
  it("points back at the bell with the same arrow the download flyout uses", async () => {
    mocks.items = [notification("info")];
    renderComponent(["info"]);

    await waitFor(() => {
      expect(document.querySelector(".nxm-overlay-arrow")).toBeInTheDocument();
    });
  });

  it("draws no hand-rolled beak of its own any more", async () => {
    mocks.items = [notification("info")];
    const { container } = renderComponent(["info"]);

    await waitFor(() => {
      expect(document.querySelector(".nxm-overlay-arrow")).toBeInTheDocument();
    });

    // The old beak was a rotated square, which could never match the tooltip's 12x8.
    expect(container.querySelector("span.rotate-45")).not.toBeInTheDocument();
  });
});
