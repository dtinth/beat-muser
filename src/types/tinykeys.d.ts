/**
 * Workaround for tinykeys v3.0.0 incomplete `exports` map.
 *
 * The package ships `dist/tinykeys.d.ts` and declares `"types": "dist/tinykeys.d.ts"`
 * in `package.json`, but the `exports` field does not include a `types` condition:
 *
 *   "exports": {
 *     ".": {
 *       "import": "./dist/tinykeys.module.js",
 *       "require": "./dist/tinykeys.js"
 *     }
 *   }
 *
 * With `moduleResolution: "bundler"` (Vite+ default), TypeScript resolves imports
 * through `exports` and ignores the legacy `"types"` field. Because there is no
 * `types` condition in `exports`, TypeScript cannot find the declaration file and
 * falls back to `any`. This file restores type safety until tinykeys fixes its
 * package.json.
 */
declare module "tinykeys" {
  export interface KeyBindingMap {
    [keybinding: string]: (event: KeyboardEvent) => void;
  }

  export interface KeyBindingHandlerOptions {
    timeout?: number;
  }

  export interface KeyBindingOptions extends KeyBindingHandlerOptions {
    event?: "keydown" | "keyup";
    capture?: boolean;
  }

  export function parseKeybinding(str: string): unknown[];
  export function createKeybindingsHandler(
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingHandlerOptions,
  ): EventListener;
  export function tinykeys(
    target: Window | HTMLElement,
    keyBindingMap: KeyBindingMap,
    options?: KeyBindingOptions,
  ): () => void;
}
