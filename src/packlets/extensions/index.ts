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
import { globalCommandRegistry } from "../command-registry/index.ts";
import type { ProjectFile } from "../project-format/index.ts";

export const BUILT_IN_EXTENSIONS = [BEAT_EXTENSION];

/** Reactive atom holding all current decoration specs from all extensions. */
export const $extensionDecorations = atom<DecorationSpec[]>([]);

const TRUST_STORAGE_KEY = "extension-trusted-urls";

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
  private fileExportDelegate: { exportFile: (name: string, data: string) => void } | null = null;
  /** Registered exporters for post-save triggering. */
  private exporters: import("./types.ts").ExporterManifest[] = [];

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

    // Worker-based extension — fetch the worker source to create a blob worker
    // (avoids cross-origin and MIME type issues with direct Worker(url) construction)
    if (manifest.worker) {
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
      const level = entity.components.level as { mode: string } | undefined;
      if (level?.mode) modes.add(level.mode);
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

let _instance: ExtensionManager | null = null;

export function getExtensionManager(): ExtensionManager {
  if (!_instance) _instance = new ExtensionManager();
  return _instance;
}

export { BEAT_EXTENSION } from "./beat-extension.ts";
