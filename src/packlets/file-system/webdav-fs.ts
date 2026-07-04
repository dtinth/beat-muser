/**
 * WebDAV-backed implementation of the {@link ProjectFileSystem}. Talks plain
 * HTTP (via `fetch`) to a WebDAV server — the reference target is
 * [dufs](https://github.com/sigoden/dufs) running inside a Tailscale tailnet —
 * so a project's assets can live on real remote storage instead of in the
 * browser. Unlike the IndexedDB backend, nothing is cached locally; every call
 * is a live request. See ADR 024.
 *
 * Design notes, verified against dufs's behaviour:
 * - `PROPFIND` supports only `Depth: 0` and `Depth: 1` (dufs rejects
 *   `infinity` with `400`), so `listFiles` walks the tree one collection at a
 *   time with `Depth: 1`.
 * - `PUT` auto-creates parent collections (dufs runs `create_dir_all`), so
 *   `writeFile` on a nested path is a single request — no `MKCOL` walk.
 * - Auth is an explicit `Authorization: Basic` header, never cookie-based
 *   credentials. dufs's `--enable-cors` sends `Access-Control-Allow-Origin: *`
 *   together with `Access-Control-Allow-Credentials: true`, a combination the
 *   browser rejects for *credentialed* requests; leaving `credentials` at its
 *   default avoids that trap while still sending the header, which dufs
 *   explicitly allow-lists (`Access-Control-Allow-Headers: Authorization,*`).
 *
 * The multistatus response is parsed with a small prefix-tolerant string
 * scanner rather than `DOMParser`, so the backend has no dependency on a
 * browser DOM and behaves identically under Node-based unit tests.
 */

import type { FileEntry, ProjectFileSystem } from "./types.ts";
import { FileNotFoundError } from "./indexeddb-fs.ts";

export interface WebDavConfig {
  /** Base URL of the WebDAV collection that backs the project. */
  url: string;
  /** Optional HTTP Basic auth username (omit for anonymous access). */
  username?: string;
  /** Optional HTTP Basic auth password. */
  password?: string;
}

/** One entry parsed from a PROPFIND multistatus response. */
export interface WebDavEntry {
  /** Server-absolute, still-URL-encoded href, e.g. `/proj/audio/kick.ogg`. */
  href: string;
  isCollection: boolean;
  contentLength?: number;
  lastModified?: string;
}

// Local-name matchers that ignore any `prefix:` (D:, d:, lp1:, or none) so the
// scanner tolerates whatever namespace prefix the server emits.
const RESPONSE_RE = /<(?:[\w-]+:)?response[\s>][\s\S]*?<\/(?:[\w-]+:)?response>/g;
const HREF_RE = /<(?:[\w-]+:)?href[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?href>/;
const LENGTH_RE = /<(?:[\w-]+:)?getcontentlength[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?getcontentlength>/;
const MODIFIED_RE = /<(?:[\w-]+:)?getlastmodified[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?getlastmodified>/;
const COLLECTION_RE = /<(?:[\w-]+:)?collection[\s/>]/;

function decodeXmlText(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&"); // must be last so decoded entities aren't re-decoded
}

/** Parses a WebDAV 207 multistatus XML body into flat entries. */
export function parseMultistatus(xml: string): WebDavEntry[] {
  const entries: WebDavEntry[] = [];
  for (const [block] of xml.matchAll(RESPONSE_RE)) {
    const hrefMatch = block.match(HREF_RE);
    if (!hrefMatch) continue;
    const lengthText = block.match(LENGTH_RE)?.[1]?.trim();
    const modifiedText = block.match(MODIFIED_RE)?.[1]?.trim();
    entries.push({
      href: decodeXmlText(hrefMatch[1].trim()),
      isCollection: COLLECTION_RE.test(block),
      contentLength: lengthText ? Number(lengthText) : undefined,
      lastModified: modifiedText ? decodeXmlText(modifiedText) : undefined,
    });
  }
  return entries;
}

export function createFileSystemFromWebDav(config: WebDavConfig): ProjectFileSystem {
  // Normalise to a directory URL with a trailing slash so relative paths
  // resolve against the collection rather than replacing its last segment.
  const base = new URL(config.url.endsWith("/") ? config.url : `${config.url}/`);
  const basePath = decodeURIComponent(base.pathname);

  function authHeaders(): Record<string, string> {
    if (config.username === undefined) return {};
    // Base64 of the UTF-8 bytes, not of the raw string: `btoa` throws on any
    // code point above U+00FF, so a Thai or emoji character in the credentials
    // would otherwise crash every request (RFC 7617 also mandates UTF-8).
    const bytes = new TextEncoder().encode(`${config.username}:${config.password ?? ""}`);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { Authorization: `Basic ${btoa(binary)}` };
  }

  function urlFor(path: string): string {
    // Encode each segment so spaces/unicode in file names survive, but keep
    // the slashes as path separators.
    const encoded = path.split("/").map(encodeURIComponent).join("/");
    return new URL(encoded, base).toString();
  }

  async function request(
    method: string,
    path: string,
    opts?: { headers?: Record<string, string>; body?: BodyInit },
  ): Promise<Response> {
    return fetch(urlFor(path), {
      method,
      headers: { ...authHeaders(), ...opts?.headers },
      body: opts?.body,
    });
  }

  /** Turns a server-absolute href into a path relative to the collection root. */
  function hrefToRelativePath(href: string): string | undefined {
    // hrefs may be absolute URLs or absolute paths; both resolve against base.
    const pathname = decodeURIComponent(new URL(href, base).pathname);
    if (!pathname.startsWith(basePath)) return undefined;
    const relative = pathname.slice(basePath.length).replace(/^\/+|\/+$/g, "");
    return relative === "" ? undefined : relative;
  }

  /**
   * Lists the direct children of one collection (`Depth: 1`). Returns file
   * entries plus the relative paths of any child collections to recurse into.
   */
  async function propfindDepth1(dirPath: string): Promise<{ files: FileEntry[]; dirs: string[] }> {
    const res = await request("PROPFIND", dirPath, {
      headers: { Depth: "1", "Content-Type": "application/xml" },
    });
    if (res.status === 404) return { files: [], dirs: [] };
    if (!res.ok) {
      throw new Error(`PROPFIND ${dirPath || "/"} failed: ${res.status} ${res.statusText}`);
    }

    const files: FileEntry[] = [];
    const dirs: string[] = [];
    for (const entry of parseMultistatus(await res.text())) {
      const path = hrefToRelativePath(entry.href);
      // The collection itself is included in a Depth:1 listing — skip it.
      if (path === undefined || path === dirPath) continue;
      if (entry.isCollection) {
        dirs.push(path);
        continue;
      }
      files.push({
        name: path.split("/").pop() ?? path,
        path,
        size: entry.contentLength ?? 0,
        lastModified: entry.lastModified ? new Date(entry.lastModified) : new Date(0),
      });
    }
    return { files, dirs };
  }

  return {
    readOnly: false,

    async listFiles() {
      const all: FileEntry[] = [];
      // Breadth-first walk: dufs caps PROPFIND at Depth:1, so recurse manually.
      const queue = [""];
      while (queue.length > 0) {
        const dir = queue.shift()!;
        const { files, dirs } = await propfindDepth1(dir);
        all.push(...files);
        queue.push(...dirs);
      }
      return all;
    },

    async readFile(path: string) {
      const res = await request("GET", path);
      if (res.status === 404) throw new FileNotFoundError(path);
      if (!res.ok) {
        throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
      }
      return res.arrayBuffer();
    },

    async readText(path: string) {
      const buffer = await this.readFile(path);
      return new TextDecoder().decode(buffer);
    },

    async writeFile(path: string, content: string | ArrayBuffer) {
      // dufs creates missing parent collections on PUT, so a single request
      // suffices even for nested paths.
      const res = await request("PUT", path, { body: content });
      if (!res.ok) {
        throw new Error(`PUT ${path} failed: ${res.status} ${res.statusText}`);
      }
    },

    async deleteFile(path: string) {
      const res = await request("DELETE", path);
      // Treat an already-absent file as success, matching the other backends'
      // idempotent delete semantics.
      if (!res.ok && res.status !== 404) {
        throw new Error(`DELETE ${path} failed: ${res.status} ${res.statusText}`);
      }
    },
  };
}
