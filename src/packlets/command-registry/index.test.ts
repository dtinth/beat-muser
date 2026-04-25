/**
 * @packageDocumentation
 *
 * Unit tests for the command registry system.
 */

import { describe, expect, test, vi, beforeAll, afterEach } from "vite-plus/test";
import { CommandRegistry, CommandSet, KeyboardShortcutHandler } from "./index";

// Polyfill KeyboardEvent for Node.js test environment (tinykeys uses instanceof)
beforeAll(() => {
  if (typeof globalThis.KeyboardEvent === "undefined") {
    globalThis.KeyboardEvent = class KeyboardEvent {
      key: string;
      code: string;
      ctrlKey: boolean;
      metaKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      defaultPrevented = false;

      constructor(
        _type: string,
        init: {
          key?: string;
          code?: string;
          ctrlKey?: boolean;
          metaKey?: boolean;
          shiftKey?: boolean;
          altKey?: boolean;
        } = {},
      ) {
        this.key = init.key ?? "";
        this.code = init.code ?? "";
        this.ctrlKey = init.ctrlKey ?? false;
        this.metaKey = init.metaKey ?? false;
        this.shiftKey = init.shiftKey ?? false;
        this.altKey = init.altKey ?? false;
      }

      preventDefault() {
        this.defaultPrevented = true;
      }

      getModifierState(key: string) {
        if (key === "Meta") return this.metaKey;
        if (key === "Control") return this.ctrlKey;
        if (key === "Shift") return this.shiftKey;
        if (key === "Alt") return this.altKey;
        return false;
      }
    } as unknown as typeof KeyboardEvent;
  }
});

describe("CommandRegistry", () => {
  test("registers a command and executes it", () => {
    const registry = new CommandRegistry();
    const execute = vi.fn();

    registry.register({ id: "test", title: "Test", execute });
    registry.execute("test");

    expect(execute).toHaveBeenCalledTimes(1);
  });

  test("throws when registering duplicate command id", () => {
    const registry = new CommandRegistry();
    registry.register({ id: "test", title: "Test", execute: vi.fn() });

    expect(() => {
      registry.register({ id: "test", title: "Test 2", execute: vi.fn() });
    }).toThrow('Command "test" is already registered');
  });

  test("throws when executing unknown command", () => {
    const registry = new CommandRegistry();

    expect(() => registry.execute("unknown")).toThrow('Command "unknown" not found');
  });

  test("get returns undefined for unknown command", () => {
    const registry = new CommandRegistry();
    expect(registry.get("missing")).toBeUndefined();
  });

  test("get returns the registered command", () => {
    const registry = new CommandRegistry();
    const command = { id: "test", title: "Test", execute: vi.fn() };

    registry.register(command);

    expect(registry.get("test")).toBe(command);
  });

  test("getAll returns all registered commands", () => {
    const registry = new CommandRegistry();
    const a = { id: "a", title: "A", execute: vi.fn() };
    const b = { id: "b", title: "B", execute: vi.fn() };

    registry.register(a);
    registry.register(b);

    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getAll()).toContain(a);
    expect(registry.getAll()).toContain(b);
  });

  test("unregister removes the command", () => {
    const registry = new CommandRegistry();
    const unregister = registry.register({
      id: "test",
      title: "Test",
      execute: vi.fn(),
    });

    unregister();

    expect(registry.get("test")).toBeUndefined();
    expect(() => registry.execute("test")).toThrow();
  });

  test("findByShortcut returns command matching shortcut", () => {
    const registry = new CommandRegistry();
    const command = {
      id: "zoomIn",
      title: "Zoom In",
      shortcut: "Equal",
      execute: vi.fn(),
    };

    registry.register(command);

    expect(registry.findByShortcut("Equal")).toBe(command);
    expect(registry.findByShortcut("Minus")).toBeUndefined();
  });

  test("subscribe is notified on register and unregister", () => {
    const registry = new CommandRegistry();
    const callback = vi.fn();

    const unsub = registry.subscribe(callback);
    expect(callback).not.toHaveBeenCalled();

    registry.register({ id: "a", title: "A", execute: vi.fn() });
    expect(callback).toHaveBeenCalledTimes(1);

    const unregister = registry.register({
      id: "b",
      title: "B",
      execute: vi.fn(),
    });
    expect(callback).toHaveBeenCalledTimes(2);

    unregister();
    expect(callback).toHaveBeenCalledTimes(3);

    unsub();
  });
});

describe("CommandSet", () => {
  test("registers multiple commands to a registry", () => {
    const registry = new CommandRegistry();
    const set = new CommandSet();
    const a = { id: "a", title: "A", execute: vi.fn() };
    const b = { id: "b", title: "B", execute: vi.fn() };

    set.add(a);
    set.add(b);
    const unregister = set.registerTo(registry);

    expect(registry.getAll()).toHaveLength(2);

    unregister();
    expect(registry.getAll()).toHaveLength(0);
  });

  test("unregistering a set removes only its commands", () => {
    const registry = new CommandRegistry();
    registry.register({ id: "pre", title: "Pre", execute: vi.fn() });

    const set = new CommandSet();
    set.add({ id: "a", title: "A", execute: vi.fn() });
    const unregister = set.registerTo(registry);

    expect(registry.getAll()).toHaveLength(2);

    unregister();
    expect(registry.getAll()).toHaveLength(1);
    expect(registry.get("pre")).toBeDefined();
  });
});

describe("KeyboardShortcutHandler", () => {
  function keyEvent(
    init: {
      key?: string;
      code?: string;
      ctrlKey?: boolean;
      metaKey?: boolean;
    } = {},
  ): KeyboardEvent {
    return new KeyboardEvent("keydown", init);
  }

  test("onKeyDown executes command for matching shortcut", () => {
    const registry = new CommandRegistry();
    const execute = vi.fn();
    registry.register({ id: "zoomIn", title: "Zoom In", shortcut: "Equal", execute });

    const handler = new KeyboardShortcutHandler({ registry });
    handler.onKeyDown(keyEvent({ code: "Equal", key: "=" }));

    expect(execute).toHaveBeenCalledTimes(1);
  });

  test("onKeyDown calls preventDefault for matched shortcuts", () => {
    const registry = new CommandRegistry();
    registry.register({ id: "zoomIn", title: "Zoom In", shortcut: "Equal", execute: vi.fn() });

    const handler = new KeyboardShortcutHandler({ registry });
    const event = keyEvent({ code: "Equal", key: "=" });
    handler.onKeyDown(event);

    expect(event.defaultPrevented).toBe(true);
  });

  test("onKeyDown does nothing for unmatched keys", () => {
    const registry = new CommandRegistry();
    const execute = vi.fn();
    registry.register({ id: "zoomIn", title: "Zoom In", shortcut: "Equal", execute });

    const handler = new KeyboardShortcutHandler({ registry });
    handler.onKeyDown(keyEvent({ code: "Minus", key: "-" }));

    expect(execute).not.toHaveBeenCalled();
  });

  test("rebuilds bindings when registry changes", () => {
    const registry = new CommandRegistry();
    const zoomOut = vi.fn();
    registry.register({ id: "zoomIn", title: "Zoom In", shortcut: "Equal", execute: vi.fn() });

    const handler = new KeyboardShortcutHandler({ registry });
    handler.onKeyDown(keyEvent({ code: "Minus", key: "-" }));
    expect(zoomOut).not.toHaveBeenCalled();

    registry.register({ id: "zoomOut", title: "Zoom Out", shortcut: "Minus", execute: zoomOut });
    handler.onKeyDown(keyEvent({ code: "Minus", key: "-" }));
    expect(zoomOut).toHaveBeenCalledTimes(1);
  });

  describe("platform-specific shortcuts", () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(globalThis.navigator, "platform");

    afterEach(() => {
      if (originalPlatform) {
        Object.defineProperty(globalThis.navigator, "platform", originalPlatform);
      }
    });

    test("uses shortcutMac on macOS", () => {
      Object.defineProperty(globalThis.navigator, "platform", {
        value: "MacIntel",
        writable: false,
        configurable: true,
      });

      const registry = new CommandRegistry();
      const execute = vi.fn();
      registry.register({
        id: "save",
        title: "Save",
        shortcut: "Control+KeyS",
        shortcutMac: "Meta+KeyS",
        execute,
      });

      const handler = new KeyboardShortcutHandler({ registry });
      handler.onKeyDown(keyEvent({ code: "KeyS", key: "s", metaKey: true }));

      expect(execute).toHaveBeenCalledTimes(1);
    });

    test("uses shortcut on non-macOS", () => {
      Object.defineProperty(globalThis.navigator, "platform", {
        value: "Win32",
        writable: false,
        configurable: true,
      });

      const registry = new CommandRegistry();
      const execute = vi.fn();
      registry.register({
        id: "save",
        title: "Save",
        shortcut: "Control+KeyS",
        shortcutMac: "Meta+KeyS",
        execute,
      });

      const handler = new KeyboardShortcutHandler({ registry });
      handler.onKeyDown(keyEvent({ code: "KeyS", key: "s", ctrlKey: true }));

      expect(execute).toHaveBeenCalledTimes(1);
    });
  });
});
