# Beat Muser

Rhythm game notechart/beatmap editor web app.

## Commands

```
vp run dev          # Start dev server on port 15036
vp run check        # Format + lint + typecheck (run before commit)
vp run check --fix  # Auto-fix formatting
vp run test         # Run Vitest unit tests (colocated *.test.ts)
vp run test --run   # Non-watch mode
vp exec playwright test  # E2E tests (Chromium only, dev server must be running)
```

Always use `vp run` for scripts and `vp exec` for binaries. Do not use `pnpm`/`npm`/`yarn` directly.

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
- `__demo__` slug bypasses IndexedDB, loads from demo VFS

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

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
