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

export class WorkerExtension implements Extension {
  readonly manifest: ExtensionManifest;
  private manifestData: Record<string, unknown>;
  private worker: Worker | null = null;
  private pendingRpc = new Map<number, PendingRpc>();
  private nextRpcId = 1;
  private lastEntities: unknown[] | null = null;
  private onDecorations: ((decorations: DecorationSpec[]) => void) | null = null;
  private onExportFile: ((name: string, data: string) => void) | null = null;

  constructor(manifestData: Record<string, unknown>, workerSource: string | null) {
    this.manifestData = manifestData;
    this.manifest = {
      id: manifestData.id as string,
      name: manifestData.name as string,
      version: manifestData.version as string,
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
    for (const [id, ps] of Object.entries((data.propertySets ?? {}) as Record<string, unknown>)) {
      host.registerPropertySet(id, ps as PropertySet);
    }
    for (const gm of (data.gameModes ?? []) as Record<string, unknown>[]) {
      host.registerGameMode(gm as unknown as GameModeLayout);
    }
    for (const rule of (data.coloringRules ?? []) as Record<string, unknown>[]) {
      host.registerColoringRule(rule as unknown as ColoringRule);
    }
    for (const exporter of (data.exporters ?? []) as Record<string, unknown>[]) {
      host.registerExporter(exporter as unknown as ExporterManifest);
    }

    const worker = this.worker;
    if (!worker) {
      for (const cmd of (data.commands ?? []) as { id: string; title: string }[]) {
        host.registerCommand({ id: cmd.id, title: cmd.title, execute: () => {} });
      }
      return;
    }

    // Register commands — each dispatches execute-command to the worker
    for (const cmd of (data.commands ?? []) as { id: string; title: string; shortcut?: string }[]) {
      host.registerCommand({
        id: cmd.id,
        title: cmd.title,
        shortcut: cmd.shortcut,
        execute: () => {
          worker.postMessage({ type: "execute-command", commandId: cmd.id });
        },
      });
    }

    // Handle messages from the worker
    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;

      // Decoration specs from worker
      if (msg.type === "decorations") {
        this.onDecorations?.(msg.decorations as DecorationSpec[]);
        return;
      }

      // JSON-RPC request from worker
      if (msg.jsonrpc === "2.0" && msg.method) {
        this.handleRpc(host, worker, msg);
        return;
      }

      // JSON-RPC response
      if (msg.jsonrpc === "2.0" && typeof msg.id === "number") {
        const pending = this.pendingRpc.get(msg.id);
        if (pending) {
          if (msg.error) {
            pending.reject(new Error(msg.error.message ?? "RPC error"));
          } else {
            pending.resolve(msg.result);
          }
          this.pendingRpc.delete(msg.id);
        }
        return;
      }

      if (msg.type === "command-complete") {
        return;
      }
    };

    worker.onerror = (event: ErrorEvent) => {
      console.warn(`Extension worker error [${this.manifest.id}]:`, event.message);
    };
  }

  callRpc(method: string, params: unknown): Promise<unknown> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error("Worker not available"));
    const id = this.nextRpcId++;
    return new Promise((resolve, reject) => {
      this.pendingRpc.set(id, { resolve, reject });
      worker.postMessage({ jsonrpc: "2.0", id, method, params });
    });
  }

  private handleRpc(
    host: ExtensionHost,
    worker: Worker,
    msg: { id?: number; method: string; params: unknown },
  ): void {
    const respond = (result: unknown) => {
      if (msg.id !== undefined) {
        worker.postMessage({ jsonrpc: "2.0", id: msg.id, result });
      }
    };
    const respondError = (error: Error) => {
      if (msg.id !== undefined) {
        worker.postMessage({ jsonrpc: "2.0", id: msg.id, error: { message: error.message } });
      }
    };

    try {
      switch (msg.method) {
        case "applyProperty": {
          const params = msg.params as { key: string; value: unknown };
          host.applyProperty(params.key, params.value);
          respond({});
          break;
        }
        case "readEntities": {
          respond({ entities: this.lastEntities ?? [] });
          break;
        }
        case "exportFile": {
          const params = msg.params as { name: string; data: string };
          this.onExportFile?.(params.name, params.data);
          respond({});
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
