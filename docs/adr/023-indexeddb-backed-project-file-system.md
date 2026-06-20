# IndexedDB-backed project file system

The editor accesses project files through the `ProjectFileSystem` abstraction, which is normally backed by the File System Access API (a real directory handle). That API is unavailable in some browsers — notably iPad Safari — leaving the editor unusable there.

We add a third **Project source** variant, `indexeddb`, implementing the same `ProjectFileSystem` (read **and** write) over file blobs stored in a dedicated IndexedDB `files` object store, keyed by a per-source `[storeId, path]` compound key. `storeId` is an independent UUID held in the source (not the project id), so file buckets are decoupled from project identity. Removing a project cascade-deletes its blobs.

Because there is no OS folder to drop files into, IndexedDB-backed projects need an in-app way to move assets in and out: the **Project Files panel** (a tab in the Sounds panel) provides upload, per-file download, and delete over the `ProjectFileSystem`, gated by a new `readOnly` capability flag. Whole-project zip import/export is planned as a fast-follow for the iPad↔desktop round-trip.

This is deliberately a **secondary** store: we do not want large audio blobs in IndexedDB and keep the File System Access backend as the primary path for desktop. IndexedDB is accepted only because iPad Safari offers no alternative. The `indexeddb` provider sits co-equal alongside `filesystem` and `examples` in `createProjectFileSystem`; the route loader, project view, and audio engine remain unaware of which backend is in use.

## Consequences

- The route loader must generalize its "missing project file → empty project" handling beyond the filesystem-only `DOMException` `NotFoundError`, and skip the filesystem-only `requestPermission` step for non-filesystem sources.
- "Open Folder" stays visible on unsupported browsers but shows an explanatory error (requires a Chromium-based desktop browser) instead of failing silently.
- Known limitation: uploading or replacing a file does not trigger the audio engine to re-decode (its path-diff logic ignores same-path byte changes); a page reload is required for now.
