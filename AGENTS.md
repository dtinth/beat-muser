# Beat Muser

Rhythm game notechart/beatmap editor web app.

## Commands

```
vp run check        # Format + lint + typecheck (run before commit)
vp run check --fix  # Auto-fix formatting
vp run test         # Run Vitest unit tests (colocated *.test.ts)
vp run test --run   # Non-watch mode
vp exec playwright test  # E2E tests (Chromium only, dev server must be running)
```

Always use `vp run` for scripts and `vp exec` for binaries. Do not use `pnpm`/`npm`/`yarn` directly.

## Dev Server (Pitchfork)

The dev server is managed by **Pitchfork** (defined in `pitchfork.toml`). **Never run `vp run dev` directly** — always use Pitchfork so the server runs under supervision with proper ready checks and log capture.

Docs: <https://pitchfork.jdx.dev/>

```
pitchfork start dev    # Start dev server (waits until port 15036 is ready)
pitchfork stop dev     # Stop dev server
pitchfork restart dev  # Restart dev server
pitchfork status dev   # Show daemon status (PID, state)
pitchfork logs dev     # Tail dev server logs
pitchfork list         # List all managed daemons
```

## Architecture

### Packlets (`src/packlets/<name>/index.ts`)

Packlets are the module boundary system. Each packlet exports from `index.ts`. Packlets may only import other packlets or npm packages — no circular deps. Enforced manually (Oxlint can't run ESLint packlet plugins).

Each packlet should include a `@packageDocumentation` comment at the top of its `index.ts` summarizing its purpose. Run the following command to see an up-to-date list:

```
vp run list-packlets
```

When changing a packlet's public API or responsibilities, update its `@packageDocumentation` comment so the description stays accurate.

### Routing

Defined in `src/routes.tsx`.

### Layout

Fixed full-viewport flex column with header, toolbar, panels, timeline, and status bar. Implemented in `src/routes.tsx` and `src/packlets/project-layout/index.tsx`.

### Project File Format (`beat-muser-project.json`)

Event-based chart format (PPQN 240, default BPM 60) with versioned metadata, charts, and open-ended entities. Schemas in `src/packlets/project-format/schema.ts`.

### Provider Abstraction

- `{ provider: 'filesystem', handle: FileSystemDirectoryHandle }`
- `{ provider: 'examples', name: string }`
- `{ provider: 'indexeddb', storeId: string }` — files stored as blobs in IndexedDB, for browsers without the File System Access API (iPad Safari). See ADR 023.
- `{ provider: 'webdav', url, username?, password? }` — files stored on a remote WebDAV server (reference target: dufs). See ADR 024.
- `__demo__` slug bypasses IndexedDB, loads from demo VFS
- `createProjectFileSystem` lives in `project-store` (which owns `ProjectSource`); `file-system` is a backend-only packlet to avoid a cycle.

## Testing

- **Unit**: colocated `*.test.ts` in `src/`, run with `vp test`
- **E2E**: `tests/*.spec.ts`, Chromium only, `baseURL: "http://localhost:15036"`
- Playwright config must **not** spawn its own `webServer` — dev server runs manually
- Vitest excludes `**/tests/**` and `**/node_modules/**`

## CI

`.github/workflows/ci.yml` — three jobs: `check`, `test`, `e2e`.

- Uses `voidzero-dev/setup-vp@v1` and `actions/checkout@v6`
- E2E uses `dtinth/setup-playwright-test-docker@main` (2x faster than `playwright install`)

## Conventions

- Radix Themes: dark mode, lime accent
- Icon library: `lucide-react`
- Toolbar buttons: `<Button variant="surface" size="1" color="gray">` at 32×32
- `moduleDetection: "auto"` in `tsconfig.json` required for CSS module declarations
- **Always include `.ts`/`.tsx` extensions in relative imports** — Node 24's native TypeScript runner requires them. Never use bare directory imports (e.g. `"../entity-manager"` → use `"../entity-manager/index.ts"`).

### Coordinate Space Naming

Defined in `docs/coordinate-spaces.md`. Every coordinate variable carries its space as a suffix:

| Space          | Suffix     | Examples                                                  |
| -------------- | ---------- | --------------------------------------------------------- |
| Timeline Y     | `Y`        | `segmentY`, `scrollY`, `waveformBottomY`                  |
| Pulse          | `Pulse`    | `cursorPulse`, `eventPulse`, `trimPulse`                  |
| Chart time     | `ChartSec` | `triggerChartSec`, `cursorChartSec`, `chainStartChartSec` |
| Audio time     | `AudioSec` | `audioStartSec`, `sampleOffsetAudioSec`                   |
| Waveform frame | `Frame`    | `frameStart`, `frameEnd`                                  |

Conversion functions use `toSpaceFromSpace` naming: `pulseToSec(pulse)`, `secToPulse(sec)`.

The audio engine converts chart time to `AudioContext.currentTime` via:

```
contextTime = startContextTime + triggerChartSec / rate
chartSec   = (contextTime - startContextTime) * rate
```

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
