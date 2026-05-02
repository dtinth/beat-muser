/**
 * @packageDocumentation
 *
 * Imperative modal manager for the application UI layer.
 *
 * Inspired by VS Code's `window.showInputBox` and `window.showQuickPick`,
 * this provides a global, queue-based modal system. Call
 * `modalManager.input({...})` or `modalManager.select({...})` from anywhere
 * to show a text input or list-selection modal; the returned promise resolves
 * when the user confirms, picks, or cancels.
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

export interface SelectItem<T = unknown> {
  id: string;
  label: string;
  detail?: string;
  testId?: string;
  value: T;
}

export interface SelectModalOptions {
  title: string;
  items: SelectItem[];
  placeholder?: string;
}

type InputRequest = { type: "input"; id: string } & InputModalOptions;
type SelectRequest = { type: "select"; id: string } & SelectModalOptions;

export type ModalRequest = InputRequest | SelectRequest;

export class ModalManager {
  $stack = atom<ModalRequest[]>([]);
  private resolvers = new Map<string, (value: unknown) => void>();

  input(options: InputModalOptions): Promise<string | undefined> {
    const id = generateId();
    return new Promise<string | undefined>((resolve) => {
      this.resolvers.set(id, resolve as (value: unknown) => void);
      const request: InputRequest = {
        type: "input",
        id,
        title: options.title,
        value: options.value ?? "",
        validate: options.validate,
      };
      this.$stack.set([...this.$stack.get(), request]);
    });
  }

  select<T = unknown>(
    options: SelectModalOptions & { items: SelectItem<T>[] },
  ): Promise<SelectItem<T> | undefined> {
    const id = generateId();
    return new Promise<SelectItem<T> | undefined>((resolve) => {
      this.resolvers.set(id, resolve as (value: unknown) => void);
      const request: SelectRequest = {
        type: "select",
        id,
        title: options.title,
        items: options.items as SelectItem[],
        placeholder: options.placeholder,
      };
      this.$stack.set([...this.$stack.get(), request]);
    });
  }

  dismiss(id: string, value: unknown): void {
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
