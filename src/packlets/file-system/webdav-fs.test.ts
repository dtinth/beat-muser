import { test, expect, afterEach } from "vite-plus/test";
import { createFileSystemFromWebDav, isFileNotFoundError } from "./index.ts";
import { parseMultistatus } from "./webdav-fs.ts";

const BASE = "https://dav.test/proj/";
const BASE_PATH = "/proj/";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function encodePath(rel: string): string {
  return rel
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

interface Captured {
  method: string;
  path: string;
  authorization: string | null;
  depth: string | null;
}

/**
 * Installs a minimal in-memory WebDAV server (modelled on dufs) as the global
 * `fetch`. Backs a flat map of relative path -> bytes; PUT auto-creates
 * parents (the map is keyed by full path), PROPFIND answers Depth:1 only.
 */
function installServer(seed: Record<string, string> = {}) {
  const files = new Map<string, Uint8Array>();
  for (const [path, text] of Object.entries(seed)) {
    files.set(path, new TextEncoder().encode(text));
  }
  const requests: Captured[] = [];

  function relPathFromUrl(url: string): string {
    const pathname = decodeURIComponent(new URL(url).pathname);
    return pathname.slice(BASE_PATH.length).replaceAll(/^\/+|\/+$/gu, "");
  }

  function multistatusFor(dir: string): string {
    const prefix = dir === "" ? "" : `${dir}/`;
    const childDirs = new Set<string>();
    const responses: string[] = [];

    // Self entry (a collection), as dufs includes in a Depth:1 listing.
    const selfHref = dir === "" ? BASE_PATH : `${BASE_PATH}${encodePath(dir)}/`;
    responses.push(
      `<D:response><D:href>${selfHref}</D:href><D:propstat><D:prop>` +
        `<D:resourcetype><D:collection/></D:resourcetype>` +
        `</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`,
    );

    for (const [path, bytes] of files) {
      if (dir !== "" && !path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest === "") continue;
      if (rest.includes("/")) {
        childDirs.add(prefix + rest.split("/")[0]);
        continue;
      }
      responses.push(
        `<D:response><D:href>${BASE_PATH}${encodePath(path)}</D:href>` +
          `<D:propstat><D:prop>` +
          `<D:getcontentlength>${bytes.byteLength}</D:getcontentlength>` +
          `<D:getlastmodified>Mon, 06 Jul 2026 00:00:00 GMT</D:getlastmodified>` +
          `<D:resourcetype/>` +
          `</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`,
      );
    }
    for (const childDir of childDirs) {
      responses.push(
        `<D:response><D:href>${BASE_PATH}${encodePath(childDir)}/</D:href>` +
          `<D:propstat><D:prop><D:resourcetype><D:collection/></D:resourcetype>` +
          `</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`,
      );
    }
    return `<?xml version="1.0" encoding="utf-8" ?>\n<D:multistatus xmlns:D="DAV:">${responses.join("")}</D:multistatus>`;
  }

  globalThis.fetch = ((input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    const path = relPathFromUrl(url);
    requests.push({
      method,
      path,
      authorization: headers.get("authorization"),
      depth: headers.get("depth"),
    });

    switch (method) {
      case "PROPFIND":
        return Promise.resolve(
          new Response(multistatusFor(path), {
            status: 207,
            headers: { "content-type": "application/xml" },
          }),
        );
      case "GET": {
        const bytes = files.get(path);
        if (!bytes) return Promise.resolve(new Response("Not Found", { status: 404 }));
        // Uint8Array<ArrayBufferLike> isn't accepted as BodyInit under the
        // strict lib.dom typings; the bytes are a valid body at runtime.
        return Promise.resolve(new Response(bytes as unknown as BodyInit, { status: 200 }));
      }
      case "PUT": {
        const body = init?.body;
        const bytes =
          typeof body === "string"
            ? new TextEncoder().encode(body)
            : new Uint8Array(body as ArrayBuffer);
        files.set(path, bytes);
        return Promise.resolve(new Response(null, { status: 201 }));
      }
      case "DELETE": {
        if (!files.has(path)) return Promise.resolve(new Response(null, { status: 404 }));
        files.delete(path);
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      default:
        return Promise.resolve(new Response("Method Not Allowed", { status: 405 }));
    }
  }) as typeof fetch;

  return { files, requests };
}

test("writeFile then readText round-trips text", async () => {
  installServer();
  const fs = createFileSystemFromWebDav({ url: BASE });
  await fs.writeFile("notes.txt", "hello world");
  expect(await fs.readText("notes.txt")).toBe("hello world");
});

test("writeFile then readFile round-trips binary bytes", async () => {
  installServer();
  const fs = createFileSystemFromWebDav({ url: BASE });
  const bytes = new Uint8Array([0, 1, 2, 255, 128]);
  await fs.writeFile("audio.bin", bytes.buffer);
  const read = new Uint8Array(await fs.readFile("audio.bin"));
  expect([...read]).toEqual([...bytes]);
});

test("listFiles reports name, path, and size", async () => {
  installServer({ "kick.mp3": "1234567890" });
  const fs = createFileSystemFromWebDav({ url: BASE });
  const files = await fs.listFiles();
  expect(files).toHaveLength(1);
  expect(files[0]).toMatchObject({ name: "kick.mp3", path: "kick.mp3", size: 10 });
});

test("listFiles recurses into subdirectories via Depth:1 walks", async () => {
  const { requests } = installServer({
    "beat-muser-project.json": "{}",
    "audio/drums/snare.wav": "x",
    "audio/kick.ogg": "yy",
  });
  const fs = createFileSystemFromWebDav({ url: BASE });
  const files = await fs.listFiles();
  expect(new Set(files.map((f) => f.path))).toEqual(
    new Set(["beat-muser-project.json", "audio/drums/snare.wav", "audio/kick.ogg"]),
  );
  // Nested file's name is the basename.
  expect(files.find((f) => f.path === "audio/drums/snare.wav")?.name).toBe("snare.wav");
  // Every PROPFIND used Depth:1 (dufs rejects infinity).
  const propfinds = requests.filter((r) => r.method === "PROPFIND");
  expect(propfinds.length).toBeGreaterThan(1);
  expect(propfinds.every((r) => r.depth === "1")).toBe(true);
});

test("writeFile to a nested path is a single PUT (parents auto-created)", async () => {
  const { requests } = installServer();
  const fs = createFileSystemFromWebDav({ url: BASE });
  await fs.writeFile("audio/drums/snare.wav", "x");
  const writes = requests.filter((r) => r.method !== "GET");
  expect(writes).toEqual([
    { method: "PUT", path: "audio/drums/snare.wav", authorization: null, depth: null },
  ]);
  expect(await fs.readText("audio/drums/snare.wav")).toBe("x");
});

test("file names with spaces and unicode survive URL encoding", async () => {
  installServer();
  const fs = createFileSystemFromWebDav({ url: BASE });
  await fs.writeFile("drum loops/café ♥.wav", "beat");
  expect(await fs.readText("drum loops/café ♥.wav")).toBe("beat");
  const [entry] = await fs.listFiles();
  expect(entry).toMatchObject({ path: "drum loops/café ♥.wav", name: "café ♥.wav" });
});

test("deleteFile removes a file", async () => {
  installServer({ "gone.txt": "bye" });
  const fs = createFileSystemFromWebDav({ url: BASE });
  await fs.deleteFile("gone.txt");
  expect(await fs.listFiles()).toHaveLength(0);
  await expect(fs.readFile("gone.txt")).rejects.toSatisfy(isFileNotFoundError);
});

test("deleteFile of a missing file resolves (idempotent)", async () => {
  installServer();
  const fs = createFileSystemFromWebDav({ url: BASE });
  await expect(fs.deleteFile("nope.txt")).resolves.toBeUndefined();
});

test("readFile of a missing file throws a recognized not-found error", async () => {
  installServer();
  const fs = createFileSystemFromWebDav({ url: BASE });
  await expect(fs.readFile("missing.txt")).rejects.toSatisfy(isFileNotFoundError);
});

test("sends HTTP Basic auth header when credentials are configured", async () => {
  const { requests } = installServer({ "a.txt": "hi" });
  const fs = createFileSystemFromWebDav({ url: BASE, username: "user", password: "pass" });
  await fs.readText("a.txt");
  expect(requests.at(-1)?.authorization).toBe(`Basic ${btoa("user:pass")}`);
});

test("encodes non-Latin1 credentials as UTF-8 without crashing", async () => {
  const { requests } = installServer({ "a.txt": "hi" });
  const fs = createFileSystemFromWebDav({ url: BASE, username: "สมชาย", password: "🔑" });
  await fs.readText("a.txt");
  const expected = `Basic ${Buffer.from("สมชาย:🔑", "utf-8").toString("base64")}`;
  expect(requests.at(-1)?.authorization).toBe(expected);
});

test("omits the auth header for anonymous access", async () => {
  const { requests } = installServer({ "a.txt": "hi" });
  const fs = createFileSystemFromWebDav({ url: BASE });
  await fs.readText("a.txt");
  expect(requests.at(-1)?.authorization).toBeNull();
});

test("tolerates a base URL without a trailing slash", async () => {
  installServer({ "a.txt": "hi" });
  const fs = createFileSystemFromWebDav({ url: "https://dav.test/proj" });
  expect(await fs.readText("a.txt")).toBe("hi");
});

test("a writable file system reports readOnly false", () => {
  expect(createFileSystemFromWebDav({ url: BASE }).readOnly).toBe(false);
});

test("parseMultistatus tolerates lowercase and default-namespace prefixes", () => {
  const xml = `<?xml version="1.0"?>
    <multistatus xmlns="DAV:">
      <response>
        <href>/proj/a%20b.txt</href>
        <propstat><prop>
          <getcontentlength>5</getcontentlength>
          <resourcetype/>
        </prop></propstat>
      </response>
      <response>
        <href>/proj/sub/</href>
        <propstat><prop><resourcetype><collection/></resourcetype></prop></propstat>
      </response>
    </multistatus>`;
  const entries = parseMultistatus(xml);
  expect(entries).toEqual([
    { href: "/proj/a%20b.txt", isCollection: false, contentLength: 5, lastModified: undefined },
    { href: "/proj/sub/", isCollection: true, contentLength: undefined, lastModified: undefined },
  ]);
});

test("parseMultistatus decodes XML entities in hrefs", () => {
  const xml =
    `<D:multistatus xmlns:D="DAV:"><D:response>` +
    `<D:href>/proj/a&amp;b.txt</D:href>` +
    `<D:propstat><D:prop><D:resourcetype/></D:prop></D:propstat>` +
    `</D:response></D:multistatus>`;
  expect(parseMultistatus(xml)[0].href).toBe("/proj/a&b.txt");
});
