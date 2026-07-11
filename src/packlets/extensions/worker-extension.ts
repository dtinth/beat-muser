/**
 * @packageDocumentation
 *
 * Worker-based extension. Spawns a Web Worker from the extension package,
 * communicates via JSON-RPC 2.0 over postMessage.
 *
 * The worker receives entity data for decoration computation, handles
 * command execution via `execute-command` messages, and can call RPC
 * methods (e.g. `applyProperty`, `readEntities`) back to the editor.
 */

import type {
  Extension,
  ExtensionHost,
  ExtensionManifest,
  PropertySet,
  ColoringRule,
  ExporterManifest,
} from "./types.ts";
import type { GameModeLayout } from "../editor-core/lane-layouts.ts";
import type { DecorationSpec } from "../editor-core/decoration-system.ts";

interface PendingRpc {
  resolve: (result: unknown) => void;
  reject: (err: Error) => void;
}

/** A command entry declared in an extension manifest. */
interface ManifestCommand {
  id: string;
  title: string;
  shortcut?: string;
}

/**
 * Expected shape of the manifest JSON passed to a worker extension. Downloaded
 * extension manifests are untrusted JSON; this describes the fields this class
 * reads. Callers pass the parsed JSON (typed `any`), so no narrowing is needed.
 */
interface WorkerExtensionManifestData {
  id: string;
  name: string;
  version: string;
  propertySets?: Record<string, PropertySet>;
  gameModes?: GameModeLayout[];
  coloringRules?: ColoringRule[];
  exporters?: ExporterManifest[];
  commands?: ManifestCommand[];
}

/** Shape of messages received from the extension worker. */
interface WorkerMessage {
  type?: string;
  jsonrpc?: string;
  method?: string;
  id?: number;
  params?: unknown;
  result?: unknown;
  error?: { message?: string };
  decorations?: DecorationSpec[];
}

export class WorkerExtension implements Extension {
  readonly manifest: ExtensionManifest;
  private manifestData: WorkerExtensionManifestData;
  private worker: Worker | null = null;
  private pendingRpc = new Map<number, PendingRpc>();
  private nextRpcId = 1;
  private lastEntities: unknown[] | null = null;
  private onDecorations: ((decorations: DecorationSpec[]) => void) | null = null;
  private onExportFile: ((name: string, data: string) => void) | null = null;

  constructor(manifestData: WorkerExtensionManifestData, workerSource: string | null) {
    this.manifestData = manifestData;
    this.manifest = {
      id: manifestData.id,
      name: manifestData.name,
      version: manifestData.version,
    };
    if (workerSource !== null) {
      try {
        const blob = new Blob([workerSource], { type: "application/javascript" });
        const blobUrl = URL.createObjectURL(blob);
        this.worker = new Worker(blobUrl);
      } catch (err) {
        console.warn(`Failed to create worker for extension ${this.manifest.id}:`, err);
      }
    }
  }

  /**
   * Set a callback to receive decoration specs from the worker.
   */
  setOnDecorations(cb: (decorations: DecorationSpec[]) => void): void {
    this.onDecorations = cb;
  }

  /**
   * Set a callback to receive exportFile requests from the worker.
   */
  setOnExportFile(cb: (name: string, data: string) => void): void {
    this.onExportFile = cb;
  }

  /**
   * Send entities to the worker for decoration computation.
   * Called when entity data changes.
   */
  sendEntities(entities: Record<string, unknown>[]): void {
    this.lastEntities = entities;
    this.worker?.postMessage({ type: "entities-changed", entities });
  }

  connect(host: ExtensionHost): void {
    const data = this.manifestData;

    // Register declarative contributions (always — even if worker failed)
    for (const [id, ps] of Object.entries(data.propertySets ?? {})) {
      host.registerPropertySet(id, ps);
    }
    for (const gm of data.gameModes ?? []) {
      host.registerGameMode(gm);
    }
    for (const rule of data.coloringRules ?? []) {
      host.registerColoringRule(rule);
    }
    for (const exporter of data.exporters ?? []) {
      host.registerExporter(exporter);
    }

    const worker = this.worker;
    if (!worker) {
      for (const cmd of data.commands ?? []) {
        host.registerCommand({ id: cmd.id, title: cmd.title, execute: () => {} });
      }
      return;
    }

    // Register commands — each dispatches execute-command to the worker
    for (const cmd of data.commands ?? []) {
      host.registerCommand({
        id: cmd.id,
        title: cmd.title,
        shortcut: cmd.shortcut,
        execute: () => {
          worker.postMessage({ type: "execute-command", commandId: cmd.id }, []);
        },
      });
    }

    // Handle messages from the worker
    worker.addEventListener("message", (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;

      // Decoration specs from worker
      if (msg.type === "decorations") {
        if (msg.decorations !== undefined) {
          this.onDecorations?.(msg.decorations);
        }
        return;
      }

      // JSON-RPC request from worker
      if (msg.jsonrpc === "2.0" && msg.method !== undefined && msg.method !== "") {
        this.handleRpc(host, worker, { id: msg.id, method: msg.method, params: msg.params });
        return;
      }

      // JSON-RPC response
      if (msg.jsonrpc === "2.0" && typeof msg.id === "number") {
        const pending = this.pendingRpc.get(msg.id);
        if (pending) {
          if (msg.error === undefined) {
            pending.resolve(msg.result);
          } else {
            pending.reject(new Error(msg.error.message ?? "RPC error"));
          }
          this.pendingRpc.delete(msg.id);
        }
      }
    });

    worker.addEventListener("error", (event: ErrorEvent) => {
      console.warn(`Extension worker error [${this.manifest.id}]:`, event.message);
    });
  }

  callRpc(method: string, params: unknown): Promise<unknown> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Worker not available"));
    const id = this.nextRpcId++;
    return new Promise((resolve, reject) => {
      this.pendingRpc.set(id, { resolve, reject });
      worker.postMessage({ jsonrpc: "2.0", id, method, params }, []);
    });
  }

  private handleRpc(
    host: ExtensionHost,
    worker: Worker,
    msg: { id?: number; method: string; params: unknown },
  ): void {
    const respond = (result: unknown) => {
      if (msg.id !== undefined) {
        worker.postMessage({ jsonrpc: "2.0", id: msg.id, result }, []);
      }
    };
    const respondError = (error: Error) => {
      if (msg.id !== undefined) {
        worker.postMessage({ jsonrpc: "2.0", id: msg.id, error: { message: error.message } }, []);
      }
    };

    try {
      switch (msg.method) {
        case "applyProperty": {
          const p = msg.params;
          if (
            typeof p === "object" &&
            p !== null &&
            "key" in p &&
            typeof p.key === "string" &&
            "value" in p
          ) {
            host.applyProperty(p.key, p.value);
            respond({});
          } else {
            respondError(new Error("Invalid params for applyProperty"));
          }
          break;
        }
        case "readEntities": {
          respond({ entities: this.lastEntities ?? [] });
          break;
        }
        case "exportFile": {
          const p = msg.params;
          if (
            typeof p === "object" &&
            p !== null &&
            "name" in p &&
            typeof p.name === "string" &&
            "data" in p &&
            typeof p.data === "string"
          ) {
            this.onExportFile?.(p.name, p.data);
            respond({});
          } else {
            respondError(new Error("Invalid params for exportFile"));
          }
          break;
        }
        default:
          respondError(new Error(`Unknown RPC method: ${msg.method}`));
      }
    } catch (err) {
      respondError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
