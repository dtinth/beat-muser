/**
 * @packageDocumentation
 *
 * Imperative modal manager for the application UI layer.
 *
 * Inspired by VS Code's `window.showInputBox`, this provides a global,
 * queue-based modal system. Call `modalManager.input({...})` from anywhere
 * to show a text input modal; the returned promise resolves when the user
 * confirms or cancels.
 *
 * The UI layer renders a `<ModalHost>` component that subscribes to the
 * manager's `$stack` atom and displays the topmost modal. Multiple concurrent
 * requests are queued and shown sequentially.
 */

import { atom } from "nanostores";

let nextId = 0;
function generateId(): string {
  return `modal-${++nextId}`;
}

export interface InputModalOptions {
  title: string;
  value?: string;
  validate?: (value: string) => string | undefined;
}

export type ModalRequest = {
  type: "input";
  id: string;
} & InputModalOptions;

export class ModalManager {
  $stack = atom<ModalRequest[]>([]);
  private resolvers = new Map<string, (value: string | undefined) => void>();

  input(options: InputModalOptions): Promise<string | undefined> {
    const id = generateId();
    return new Promise((resolve) => {
      this.resolvers.set(id, resolve);
      const request: ModalRequest = {
        type: "input",
        id,
        title: options.title,
        value: options.value ?? "",
        validate: options.validate,
      };
      this.$stack.set([...this.$stack.get(), request]);
    });
  }

  dismiss(id: string, value: string | undefined): void {
    const resolve = this.resolvers.get(id);
    if (resolve) {
      resolve(value);
      this.resolvers.delete(id);
    }
    this.$stack.set(this.$stack.get().filter((r) => r.id !== id));
  }

  cancel(id: string): void {
    this.dismiss(id, undefined);
  }
}

export { ModalHost } from "./modal-host";
