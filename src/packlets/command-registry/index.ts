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

export interface Command {
  id: string;
  title: string;
  shortcut?: string;
  execute: () => void;
}

export class CommandRegistry {
  private commands = new Map<string, Command>();

  register(command: Command): () => void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    this.commands.set(command.id, command);
    return () => {
      this.commands.delete(command.id);
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

/** Global singleton for the active editor instance. */
export const globalCommandRegistry = new CommandRegistry();
