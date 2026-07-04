# WebDAV-backed project file system

Status: Accepted

The `ProjectFileSystem` abstraction (see ADR 023) already fronts three backends — the File System Access API, bundled examples, and IndexedDB. IndexedDB was accepted only out of necessity for browsers without File System Access (iPad Safari), and ADR 023 explicitly flags its weakness: we do not want large audio blobs living in the browser's IndexedDB.

We add a fourth **Project source** variant, `webdav`, implementing the same `ProjectFileSystem` (read **and** write) over a remote [WebDAV](https://datatracker.ietf.org/doc/html/rfc4918) server via `fetch`. The reference target is [dufs](https://github.com/sigoden/dufs) running inside a Tailscale tailnet. This gives IndexedDB-free browsers a backend backed by real remote storage instead of the browser, and makes the same project reachable from multiple devices.

The source holds only serializable config — `{ provider: "webdav"; url; username?; password? }` — so, unlike the `filesystem` handle, there is nothing to revive or re-permission on load. The `webdav` provider sits co-equal alongside the others in `createProjectFileSystem`; the route loader, project view, and audio engine remain unaware of which backend is in use.

## Design, verified against dufs's behaviour

The client is plain `fetch` + a small string scanner — no WebDAV library, no `DOMParser` (so the backend is DOM-free and unit-testable under Node). Three details were confirmed by reading dufs's source rather than assumed from the spec:

- **`PROPFIND` supports only `Depth: 0` and `Depth: 1`** (dufs rejects `infinity` with `400`; RFC 4918 makes infinite depth optional and it is commonly disabled for DoS reasons). `listFiles` therefore walks the tree breadth-first, one `Depth: 1` `PROPFIND` per collection, flattening files and recursing into child collections.
- **`PUT` auto-creates parent collections** (dufs runs `create_dir_all`), so `writeFile` on a nested path is a single request — no `MKCOL` walk.
- **Auth is an explicit `Authorization: Basic` header, never cookie credentials.** dufs's `--enable-cors` emits `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` — a combination the browser rejects for _credentialed_ requests. Sending an explicit header (and leaving `fetch`'s `credentials` at its default) keeps the request non-credentialed, so the wildcard origin is accepted; dufs allow-lists `Authorization` explicitly (`Access-Control-Allow-Headers: Authorization,*`), which matters because the `*` wildcard does not cover `Authorization`. The username is omitted entirely for anonymous access.

## Consequences

- **CORS is the operational prerequisite.** Every method used (`PROPFIND`, `PUT`, `DELETE`, plus the `Depth` and `Authorization` request headers) triggers a CORS preflight, so the server must run with CORS enabled (`dufs --enable-cors`) and, for writes, with upload/delete permitted. The connect dialog states this; a misconfigured server surfaces as a load/write error.
- **Credentials are stored in plaintext** in the persisted `ProjectSource` (IndexedDB, via `idb-keyval`). This is accepted because the reference deployment is a trusted tailnet where the no-auth path is expected; Basic auth is a convenience, not a security boundary.
- **Removing a project does not delete remote files.** Unlike the IndexedDB backend (which owns its blobs and cascade-deletes them), WebDAV points at storage the app does not own, so `removeProject` only drops the local index entry and leaves remote data intact.
- The not-found seam is unchanged: a `404` maps to the existing `FileNotFoundError`, which `isFileNotFoundError` already recognizes, so the loader's "missing project file → empty project" path works as-is.
- Known limitation (shared with ADR 023): replacing a file's bytes at the same path does not prompt the audio engine to re-decode; a reload is required.
