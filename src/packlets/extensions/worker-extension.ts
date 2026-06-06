/**
 * @packageDocumentation
 *
 * Worker-based extension. Spawns a Web Worker from the extension package,
 * communicates via JSON-RPC 2.0 over postMessage.
 *
 * Commands declared in the manifest are registered in the editor's command
 * registry and dispatched to the worker via `execute-command` messages.
 * The worker may call RPC methods (e.g. `applyProperty`) back to the editor.
 */

import type {
  Extension,
  ExtensionHost,
  ExtensionManifest,
  PropertySet,
  ColoringRule,
} from "./types.ts";
import type { GameModeLayout } from "../editor-core/lane-layouts.ts";

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

    const worker = this.worker;
    if (!worker) {
      // Worker unavailable — register commands as no-ops so shortcuts don't error
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

      // JSON-RPC request from worker → handle and respond
      if (msg.jsonrpc === "2.0" && msg.method) {
        this.handleRpc(host, worker, msg);
        return;
      }

      // JSON-RPC response to our request → resolve pending
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

      // Legacy message types
      if (msg.type === "command-complete") {
        // Worker finished processing a command — nothing to do currently
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
        default:
          respondError(new Error(`Unknown RPC method: ${msg.method}`));
      }
    } catch (err) {
      respondError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

export { type PendingRpc };
