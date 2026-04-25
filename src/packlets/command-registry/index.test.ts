/**
 * @packageDocumentation
 *
 * Unit tests for the command registry system.
 */

import { describe, expect, test, vi } from "vite-plus/test";
import { CommandRegistry, CommandSet } from "./index";

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
