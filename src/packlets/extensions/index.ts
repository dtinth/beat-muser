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
 * extensions and handles URL-based extension injection via URL params
 * and localStorage-persisted extension URLs.
 * The `EditorController` is extension-agnostic — it only exposes
 * primitives via {@link ExtensionHost}.
 */

import { atom } from "nanostores";
import { BEAT_EXTENSION } from "./beat-extension.ts";
import { WorkerExtension } from "./worker-extension.ts";
import type {
  ExtensionManifest,
  PropertyDefinition,
  PropertySet,
  ColoringRule,
  Extension,
  ExtensionHost,
  ExporterManifest,
} from "./types.ts";
import type { DecorationSpec } from "../editor-core/decoration-system.ts";
import type { GameModeLayout } from "../editor-core/lane-layouts.ts";
import { globalCommandRegistry } from "../command-registry/index.ts";
import type { ProjectFile } from "../project-format/index.ts";

/** A single command entry as it appears in a fetched extension manifest. */
interface RawExtensionCommand {
  id: string;
  title: string;
  shortcut?: string;
  applyProperty?: { key: string; value: unknown };
}

/**
 * Shape of an extension manifest as fetched (and JSON-parsed) from a remote
 * URL. Fields beyond {@link ExtensionManifest} are optional and validated at
 * runtime in {@link ExtensionManager.fetchManifest}. The index signature keeps
 * the object assignable to the `Record<string, unknown>` that
 * {@link WorkerExtension} expects.
 */
type RawExtensionManifest = {
  id: string;
  name: string;
  version: string;
  worker?: string;
  gameModes?: GameModeLayout[];
  propertySets?: Record<string, PropertySet>;
  coloringRules?: ColoringRule[];
  exporters?: ExporterManifest[];
  commands?: RawExtensionCommand[];
  [key: string]: unknown;
};

export const BUILT_IN_EXTENSIONS = [BEAT_EXTENSION];

/** Reactive atom holding all current decoration specs from all extensions. */
export const $extensionDecorations = atom<DecorationSpec[]>([]);

const SESSION_TRUST_KEY = "extension-trusted-urls";
const LOCAL_STORAGE_KEY = "installed-extensions";

export type {
  ExtensionManifest,
  PropertyDefinition,
  PropertySet,
  ColoringRule,
  Extension,
  ExtensionHost,
  ExporterManifest,
};

function isValidUrl(u: string): boolean {
  return URL.canParse(u);
}

/** Type guard narrowing a JSON-parsed value to the expected raw manifest shape. */
function isRawExtensionManifest(value: unknown): value is RawExtensionManifest {
  return typeof value === "object" && value !== null;
}

/** Parse a stored JSON string into an array of URL strings, ignoring anything malformed. */
function parseStoredUrls(raw: string | null): string[] {
  if (raw === null || raw === "") return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
}

function getSessionTrustedUrls(): Set<string> {
  try {
    return new Set(parseStoredUrls(sessionStorage.getItem(SESSION_TRUST_KEY)));
  } catch {
    return new Set();
  }
}

function storeSessionTrustedUrl(url: string): void {
  const urls = getSessionTrustedUrls();
  urls.add(url);
  try {
    sessionStorage.setItem(SESSION_TRUST_KEY, JSON.stringify([...urls]));
  } catch {
    console.warn("Failed to persist extension trust to sessionStorage");
  }
}

export function getAllExtensionUrls(): string[] {
  try {
    return parseStoredUrls(localStorage.getItem(LOCAL_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function addExtensionUrl(url: string): void {
  const urls = getAllExtensionUrls();
  if (urls.includes(url)) return;
  urls.push(url);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(urls));
  } catch {
    console.warn("Failed to persist extension URL to localStorage");
  }
}

export function removeExtensionUrl(url: string): void {
  const urls = getAllExtensionUrls().filter((u) => u !== url);
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(urls));
  } catch {
    console.warn("Failed to persist extension URL to localStorage");
  }
}

function resolveTrust(rawUrls: string[]): { trustedUrls: string[]; urlCleaned: boolean } {
  const trustedUrls: string[] = [];
  let urlCleaned = false;
  for (const url of rawUrls) {
    if (getSessionTrustedUrls().has(url)) {
      trustedUrls.push(url);
    } else if (
      confirm(`An extension wants to load from:\n\n${url}\n\nOnly load extensions you trust.`)
    ) {
      storeSessionTrustedUrl(url);
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
  private fileExportDelegate: { exportFile: (name: string, data: string) => void } | null = null;
  /** Registered exporters for post-save triggering. */
  private exporters: import("./types.ts").ExporterManifest[] = [];

  /** Reads all extension URLs from localStorage and fetches their manifests. */
  async initFromStorage(): Promise<void> {
    const urls = getAllExtensionUrls();
    const results = await Promise.allSettled(urls.map((url) => this.fetchManifest(url)));
    for (const result of results) {
      if (result.status === "fulfilled") {
        this.pendingExtensions.push(result.value);
      }
    }
  }

  /** Called from the route loader. Parses `?extension=`, resolves trust, fetches manifests. */
  async initFromUrl(pageUrl: string): Promise<void> {
    const params = new URLSearchParams(new URL(pageUrl).search);
    const rawUrls = params.getAll("extension").filter((u) => isValidUrl(u));
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
    const parsed: unknown = await res.json();
    if (!isRawExtensionManifest(parsed)) {
      throw new Error(`Manifest must be a JSON object`);
    }
    const manifest = parsed;
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

    // Worker-based extension — fetch the worker source to create a blob worker
    // (avoids cross-origin and MIME type issues with direct Worker(url) construction)
    if (manifest.worker !== undefined && manifest.worker !== "") {
      const workerUrl = new URL(manifest.worker, url).href;
      try {
        const workerRes = await fetch(workerUrl);
        if (workerRes.ok) {
          const workerSource = await workerRes.text();
          return new WorkerExtension(manifest, workerSource);
        }
      } catch {
        console.warn(`Failed to fetch worker script for ${manifest.id} from ${workerUrl}`);
      }
      return new WorkerExtension(manifest, null);
    }

    // Declarative-only extension
    const ext: Extension = {
      manifest: { id: manifest.id, name: manifest.name, version: manifest.version },
      connect(h) {
        for (const [id, ps] of Object.entries(manifest.propertySets ?? {})) {
          h.registerPropertySet(id, ps);
        }
        for (const rule of manifest.coloringRules ?? []) {
          h.registerColoringRule(rule);
        }
        for (const gm of manifest.gameModes ?? []) {
          h.registerGameMode(gm);
        }
        for (const exporter of manifest.exporters ?? []) {
          h.registerExporter(exporter);
        }
        for (const cmd of manifest.commands ?? []) {
          if (cmd.applyProperty) {
            const { key, value } = cmd.applyProperty;
            h.registerCommand({
              id: cmd.id,
              title: cmd.title,
              shortcut: cmd.shortcut,
              execute() {
                h.applyProperty(key, value);
              },
            });
          } else {
            h.registerCommand({
              id: cmd.id,
              title: cmd.title,
              shortcut: cmd.shortcut,
              execute() {
                // No-op fallback for commands without applyProperty
                // Worker-based extensions handle this via WorkerExtension.connect
              },
            });
          }
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

    // Wire decoration callbacks for worker extensions
    if (extension instanceof WorkerExtension) {
      extension.setOnDecorations((decorations) => {
        $extensionDecorations.set(decorations);
      });
      extension.setOnExportFile((name, data) => {
        this.fileExportDelegate?.exportFile(name, data);
      });
    }
  }

  /**
   * Push entity data to all worker-based extensions for decoration computation.
   */
  pushEntitiesToWorkers(entities: Record<string, unknown>[]): void {
    for (const ext of this.extensions.values()) {
      if (ext instanceof WorkerExtension) {
        ext.sendEntities(entities);
      }
    }
  }

  /**
   * Set the delegate for file export. Called once from project-view.
   */
  setFileExportDelegate(delegate: { exportFile: (name: string, data: string) => void }): void {
    this.fileExportDelegate = delegate;
  }

  /**
   * Record an exporter mapping for post-save triggering.
   */
  registerExporter(exporter: import("./types.ts").ExporterManifest): void {
    this.exporters.push(exporter);
  }

  /**
   * Called after saving a project. Checks all levels against registered exporters
   * and triggers matching exporter commands via the global command registry.
   */
  handleAfterSave(projectFile: ProjectFile): void {
    if (this.exporters.length === 0) return;
    const modes = new Set<string>();
    for (const entity of projectFile.entities) {
      const level: unknown = entity.components.level;
      if (
        typeof level === "object" &&
        level !== null &&
        "mode" in level &&
        typeof level.mode === "string" &&
        level.mode !== ""
      ) {
        modes.add(level.mode);
      }
    }
    const fired = new Set<string>();
    for (const exporter of this.exporters) {
      if (exporter.gameModes.some((m) => modes.has(m)) && !fired.has(exporter.commandId)) {
        fired.add(exporter.commandId);
        globalCommandRegistry.execute(exporter.commandId);
      }
    }
  }

  unregister(id: string): void {
    this.extensions.delete(id);
  }

  isRegistered(id: string): boolean {
    return this.extensions.has(id);
  }
}

let instance: ExtensionManager | null = null;

export function getExtensionManager(): ExtensionManager {
  instance ??= new ExtensionManager();
  return instance;
}

export { BEAT_EXTENSION } from "./beat-extension.ts";
