/**
 * @packageDocumentation
 *
 * Typed command registry for editor actions. Commands are fire-and-forget
 * units of work with metadata (title, shortcut) suitable for toolbars,
 * keyboard shortcuts, and command palettes.
 *
 * The registry is intentionally decoupled from React and the editor core.
 * It only knows how to store and dispatch commands; what a command does
 * is defined at registration time via closures.
 */

import { createNanoEvents } from "nanoevents";
import type { Emitter } from "nanoevents";
import { createKeybindingsHandler } from "tinykeys";
import type { KeyBindingMap } from "tinykeys";

export interface Command {
  id: string;
  title: string;
  shortcut?: string;
  shortcutMac?: string;
  execute: () => void;
}

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private emitter: Emitter<{ change: () => void }> = createNanoEvents();

  register(command: Command): () => void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    this.commands.set(command.id, command);
    this.emitter.emit("change");
    return () => {
      this.commands.delete(command.id);
      this.emitter.emit("change");
    };
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  execute(id: string): void {
    const command = this.commands.get(id);
    if (!command) {
      throw new Error(`Command "${id}" not found`);
    }
    command.execute();
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  findByShortcut(shortcut: string): Command | undefined {
    return this.getAll().find((c) => c.shortcut === shortcut);
  }

  subscribe(cb: () => void): () => void {
    return this.emitter.on("change", cb);
  }
}

export class CommandSet {
  private commands: Command[] = [];

  add(command: Command): void {
    this.commands.push(command);
  }

  registerTo(registry: CommandRegistry): () => void {
    const unregisters = this.commands.map((c) => registry.register(c));
    return () => {
      unregisters.forEach((fn) => fn());
    };
  }
}

export class KeyboardShortcutHandler {
  private registry: CommandRegistry;
  private handler: (event: Event) => void = () => {};
  private unsubRegistry?: () => void;

  constructor(options: { registry: CommandRegistry }) {
    this.registry = options.registry;
    this.unsubRegistry = this.registry.subscribe(() => this.refresh());
    this.refresh();
  }

  private refresh() {
    const bindings: KeyBindingMap = {};
    const isMac = navigator.platform.includes("Mac");

    for (const command of this.registry.getAll()) {
      const shortcut = isMac && command.shortcutMac ? command.shortcutMac : command.shortcut;
      if (!shortcut) continue;

      bindings[shortcut] = (event) => {
        event.preventDefault();
        command.execute();
      };
    }

    this.handler = createKeybindingsHandler(bindings);
  }

  onKeyDown(event: KeyboardEvent): void {
    this.handler(event);
  }

  dispose() {
    this.unsubRegistry?.();
  }
}

/** Global singleton for the active editor instance. */
export const globalCommandRegistry = new CommandRegistry();
