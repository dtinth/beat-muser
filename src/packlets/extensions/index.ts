/**
 * @packageDocumentation
 *
 * Extension system for the beatmap editor. An extension implements a
 * {@link Extension} interface: a manifest and a `connect` function that
 * wires into the editor's {@link ExtensionHost}.
 *
 * Built-in extensions (like the beat game mode) implement the interface
 * directly. Downloaded extensions wrap a Web Worker behind the same API.
 *
 * The {@link ExtensionManager} manages the lifecycle of registered
 * extensions. The `EditorController` is extension-agnostic — it only
 * exposes primitives via {@link ExtensionHost}.
 */

import type { GameModeLayout } from "../editor-core/lane-layouts.ts";
import { BEAT_EXTENSION } from "./beat-extension.ts";

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
}

export interface Extension {
  readonly manifest: ExtensionManifest;
  connect(host: ExtensionHost): void;
}

export interface ExtensionHost {
  registerGameMode(layout: GameModeLayout): void;
}

export class ExtensionManager {
  private host: ExtensionHost;
  private extensions = new Map<string, Extension>();

  constructor(host: ExtensionHost) {
    this.host = host;
  }

  register(extension: Extension): void {
    const id = extension.manifest.id;
    if (this.extensions.has(id)) return;
    extension.connect(this.host);
    this.extensions.set(id, extension);
  }

  unregister(id: string): void {
    this.extensions.delete(id);
  }

  isRegistered(id: string): boolean {
    return this.extensions.has(id);
  }
}

export const BUILT_IN_EXTENSIONS: readonly Extension[] = [BEAT_EXTENSION];
