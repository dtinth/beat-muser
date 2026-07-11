import { defineConfig } from "vite-plus";

const isCI = Boolean(process.env.CI);

export default defineConfig({
  server: { port: 15036 },
  test: {
    exclude: ["**/node_modules/**", "**/tests/**"],
    setupFiles: isCI ? ["allure-vitest/setup"] : [],
    reporters: isCI
      ? [
          "default",
          "github-actions",
          ["allure-vitest/reporter", { resultsDir: "ci-reports/allure-results-vitest" }],
        ]
      : ["default"],
    coverage: {
      enabled: true,
      provider: "v8",
      reporter: ["html", "text-summary", "json-summary"],
      reportsDirectory: "ci-reports/coverage",
      include: ["src/**/*.{ts,tsx}"],
    },
  },
  staged: {
    "*": "vp check --fix",
  },
  fmt: {},
  lint: {
    // Enable every category that flags genuine bugs, unsafe patterns, or
    // performance problems, and treat them all as errors. `style` and
    // `restriction` are intentionally left off: they are dominated by
    // opinionated, frequently self-contradictory rules (sort-keys, id-length,
    // no-magic-numbers, no-ternary, no-null, …) that fight idiomatic code —
    // formatting is Oxfmt's responsibility. `nursery` is off because it is
    // explicitly unstable/under-development.
    plugins: ["unicorn", "oxc", "typescript", "import", "promise", "react", "jsx-a11y", "vitest"],
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "error",
      pedantic: "error",
    },
    rules: {
      // React 19 uses the automatic JSX runtime — pulling React into scope is
      // neither needed nor desirable.
      "react/react-in-jsx-scope": "off",
      // Extremely aggressive and deliberately excluded from typescript-eslint's
      // recommended sets; it would force `readonly` onto nearly every
      // object/array parameter in the codebase.
      "typescript/prefer-readonly-parameter-types": "off",
      // Arbitrary size/complexity thresholds are a matter of taste, not
      // correctness.
      "max-lines": "off",
      "max-lines-per-function": "off",
      "max-depth": "off",
      "max-classes-per-file": "off",
      "max-dependencies": "off",
      // Pure stylistic preference that fights ordinary end-of-line comments.
      "no-inline-comments": "off",
      // Sanctioned Playwright test hooks intentionally use dunder names so the
      // e2e suite (tests/perf.spec.ts) can reach them off `window`.
      "no-underscore-dangle": [
        "error",
        { allow: ["__beatMuserProfilePerformance", "__beatMuserAudioReady"] },
      ],
    },
    overrides: [
      {
        // Test code legitimately leans on type assertions, `any`-typed mocks,
        // and loose fixtures. Relax the strictest type-safety rules there so
        // they don't drown out real findings in production code.
        files: ["**/*.test.ts", "**/*.test.tsx", "tests/**"],
        rules: {
          "typescript/no-unsafe-type-assertion": "off",
          "typescript/no-unsafe-member-access": "off",
          "typescript/no-unsafe-assignment": "off",
          "typescript/no-unsafe-argument": "off",
          "typescript/no-unsafe-call": "off",
          "typescript/no-unsafe-return": "off",
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
      denyWarnings: true,
      reportUnusedDisableDirectives: "error",
    },
  },
});
