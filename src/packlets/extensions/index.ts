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
 * extensions and handles URL-based extension injection via `?extension=`.
 * The `EditorController` is extension-agnostic — it only exposes
 * primitives via {@link ExtensionHost}.
 */

import type { GameModeLayout } from "../editor-core/lane-layouts.ts";
import { BEAT_EXTENSION } from "./beat-extension.ts";

export const BUILT_IN_EXTENSIONS = [BEAT_EXTENSION];

const TRUST_STORAGE_KEY = "extension-trusted-urls";

export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
}

export interface PropertyDefinition {
  /** Component key in entity.components that this property targets. */
  component: string;
  /** Default value when no value has been set yet. */
  default: unknown;
  /** Display label shown in the property inspector. */
  label: string;
  /** Optional UI configuration for the inspector control. */
  ui?: {
    /** Control type. Defaults to "text" if not specified. */
    control?: "text" | "number" | "segmented" | "slider" | "select";
    /** Options for segmented/select controls. */
    options?: { value: unknown; label: string }[];
    /** Min value for number/slider controls. */
    min?: number;
    /** Max value for number/slider controls. */
    max?: number;
    /** Step value for number/slider controls. */
    step?: number;
  };
}

export interface PropertySet {
  /** Display label for the property set in the inspector. */
  label: string;
  /** Map of property key to property definition. */
  properties: Record<string, PropertyDefinition>;
}

export interface ColoringRule {
  /** Unique rule identifier within the extension. */
  id: string;
  /** Priority: higher values override lower. Ties break by registration order. */
  priority: number;
  /** MongoDB-style query against entity.components. */
  match: Record<string, unknown>;
  /** Formatting to apply when matched. */
  apply: {
    /** CSS color value to use for the note. */
    noteColor: string;
  };
  /** Game mode IDs this rule applies to. If omitted, applies to all modes in the extension. */
  gameModes?: string[];
}

export interface Extension {
  readonly manifest: ExtensionManifest;
  connect(host: ExtensionHost): void;
}

export interface ExtensionHost {
  registerGameMode(layout: GameModeLayout): void;
  registerPropertySet(id: string, propertySet: PropertySet): void;
  registerColoringRule(rule: ColoringRule): void;
}

function isValidUrl(u: string): boolean {
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}

function getTrustedUrls(): Set<string> {
  try {
    const raw = sessionStorage.getItem(TRUST_STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function storeTrustedUrl(url: string): void {
  const urls = getTrustedUrls();
  urls.add(url);
  try {
    sessionStorage.setItem(TRUST_STORAGE_KEY, JSON.stringify([...urls]));
  } catch {
    console.warn("Failed to persist extension trust to sessionStorage");
  }
}

function resolveTrust(rawUrls: string[]): { trustedUrls: string[]; urlCleaned: boolean } {
  const trustedUrls: string[] = [];
  let urlCleaned = false;
  for (const url of rawUrls) {
    if (getTrustedUrls().has(url)) {
      trustedUrls.push(url);
    } else if (
      confirm(`An extension wants to load from:\n\n${url}\n\nOnly load extensions you trust.`)
    ) {
      storeTrustedUrl(url);
      trustedUrls.push(url);
    } else {
      urlCleaned = true;
    }
  }
  return { trustedUrls, urlCleaned };
}

export class ExtensionManager {
  private host: ExtensionHost | null = null;
  private extensions = new Map<string, Extension>();
  private pendingExtensions: Extension[] = [];

  /** Called from the route loader. Parses `?extension=`, resolves trust, fetches manifests. */
  async initFromUrl(pageUrl: string): Promise<void> {
    const params = new URLSearchParams(new URL(pageUrl).search);
    const rawUrls = params.getAll("extension").filter(isValidUrl);
    const { trustedUrls, urlCleaned } = resolveTrust(rawUrls);
    if (urlCleaned) {
      const cleanUrl = new URL(pageUrl);
      cleanUrl.searchParams.delete("extension");
      window.history.replaceState(window.history.state, "", cleanUrl.toString());
    }

    // Fetch all manifests while the page is loading, cache for connect()
    const results = await Promise.allSettled(trustedUrls.map((url) => this.fetchManifest(url)));
    for (const result of results) {
      if (result.status === "fulfilled") {
        this.pendingExtensions.push(result.value);
      }
    }
  }

  private async fetchManifest(url: string): Promise<Extension> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = await res.json();
    if (!manifest.id || !manifest.name) {
      throw new Error(`Missing id or name`);
    }
    if (manifest.gameModes !== undefined) {
      if (!Array.isArray(manifest.gameModes)) throw new Error(`gameModes must be an array`);
      for (const gm of manifest.gameModes) {
        if (!gm.mode || !Array.isArray(gm.lanes))
          throw new Error(`Game mode missing mode or lanes`);
      }
    }
    const ext: Extension = {
      manifest: { id: manifest.id, name: manifest.name, version: manifest.version },
      connect(h) {
        for (const [id, ps] of Object.entries(manifest.propertySets ?? {})) {
          h.registerPropertySet(id, ps as PropertySet);
        }
        for (const rule of manifest.coloringRules ?? []) {
          h.registerColoringRule(rule as ColoringRule);
        }
        for (const gm of manifest.gameModes ?? []) {
          h.registerGameMode(gm);
        }
        for (const rule of manifest.coloringRules ?? []) {
          h.registerColoringRule(rule as ColoringRule);
        }
      },
    };
    return ext;
  }

  /** Called after the EditorController is created. Registers all extensions synchronously. */
  connect(host: ExtensionHost): void {
    this.host = host;

    // Register built-in extensions
    for (const ext of BUILT_IN_EXTENSIONS) {
      this.register(ext);
    }

    // Register URL extensions (already fetched in initFromUrl)
    for (const ext of this.pendingExtensions) {
      this.register(ext);
    }
    this.pendingExtensions = [];
  }

  register(extension: Extension): void {
    if (!this.host) return;
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

let _instance: ExtensionManager | null = null;

export function getExtensionManager(): ExtensionManager {
  if (!_instance) _instance = new ExtensionManager();
  return _instance;
}

export { BEAT_EXTENSION } from "./beat-extension.ts";
