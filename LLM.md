# 🤖 LLM On-boarding Sheet – *Moonwall* Monorepo

This file is **only** meant for Large Language Models (LLMs) and other tooling that need a **quick, self-contained mental model** of this code-base.  It intentionally duplicates information that is scattered across `README.md`, the docs site and the source tree.

Humans are welcome to read it too, but its primary goal is to make automated contributions safer and faster.

---

## 1. What is Moonwall?

*Moonwall* is an **all-in-one TypeScript testing framework for Substrate based blockchains** (e.g. Moonbeam, Polkadot, Kusama, Tanssi).  It ships a CLI that can:

1. Spin-up different kinds of local networks (`chopsticks` simulator, `zombienet`, raw native binaries, remote “read-only” connections, etc.).
2. Run declarative, Vitest-powered test-suites against those networks.
3. Download pre-built chain binaries or runtimes from GitHub.
4. Provide interactive tooling (log tailing, shell-into-node, etc.).

The project is maintained by **Moonsong Labs** but is generic enough for any Substrate parachain.

---

## 2. Repository layout (high-level)

```
/                             – monorepo root (pnpm workspace)
│
├─ packages/                  – source code split by npm package
│   ├─ cli/       → @moonwall/cli    (public CLI + public library exports)
│   ├─ types/     → @moonwall/types  (shared type-definitions & JSON schema)
│   └─ util/      → @moonwall/util   (pure helper functions/classes)
│
├─ docs/                       – VitePress documentation site
├─ test/                       – real test-suites executed by Moonwall itself
├─ *.json, tsconfig.json        – root configs (pnpm, TypeScript, Biome…)
└─ LLM.md                      – <-- you are here
```

### Package inter-relations

```
@moonwall/cli  ─┐
                │  re-exports →  @moonwall/types
@moonwall/util ─┘                @moonwall/util
```

The CLI package consumes **util** + **types** and re-exports many helpers so users can write:

```ts
import { describeSuite, expect } from "@moonwall/cli";
```

---

## 3. Core runtime requirements

• Node 20+   • pnpm 7+   • ESM modules only (no CommonJS build is produced)

All three first-party packages are compiled with **tsup** to a single ESM bundle under `dist/` and publish **type declarations** alongside.

---

## 4. Main external libraries / frameworks

The list below is ordered by functional area so an LLM can quickly pick the right tool-APIs while coding.

Blockchain / RPC
• `@polkadot/api`, `api-derive`, `keyring`, `util-crypto` – Substrate RPC & codec layer
• `ethers` 6.x                                         – EVM RPC in TS
• `web3` 4.x                                          – legacy EVM client
• `viem`                                              – lightweight EVM client
• `@acala-network/chopsticks`                         – Substrate fork-mode simulator
• `@zombienet/orchestrator` & `@zombienet/utils`      – multi-node orchestrator

CLI / TUI
• `ink` (React-in-CLI)             – rich interactive UI components
• `yargs`                           – argument parsing
• `chalk`, `cli-progress`, `cfonts` – colouring & progress bars

Testing
• `vitest` + `@vitest/ui`          – test-runner & reporter; Moonwall builds its BDD wrappers (`describeSuite`, etc.) on top of Vitest

Build & Tooling
• `tsup`  – bundler
• `tsx`   – `tsx node.ts` runner used while developing
• `biome` – formatter & linter (replaces ESLint + Prettier)
• `changesets` – versioning & release automation

Misc
• `dockerode`      – spawn real nodes inside Docker when needed
• `octokit/rest`   – GitHub API (artifact downloads)
• `dotenv`         – env loading
• `bottleneck`     – rate limiting async tasks

---

## 5. Coding style & conventions

1. **TypeScript strict-mode** (`strict: true`, `esModuleInterop: true` in tsconfig).
2. **ESNext module & target** – all source imports use `import … from` and top-level `await` is allowed.
3. **Biome** formatting rules (see `biome.json`):
   • 2-space indentation
   • semicolons required
   • trailing commas on multi-line lists (`es5`)
   • max line width ≈ 100
4. Tests live next to other tests under `test/suites/**`.  They are always:
   ```ts
   describeSuite({
     id: "B01",
     title: "…",
     testCases: ({ it, log }) => {
       it({ id: "T01", title: "…", test: () => { /* vitest asserts */ } });
     }
   });
   ```
5. Source files are grouped in **feature folders**, not by layer: e.g. `cli/src/internal/{cmdFunctions, foundations, …}`.
6. Prefer **pure functions**; side-effects are isolated in helpers like `processHelpers.ts`.

---

## 6. How major features are implemented (bird’s-eye)

• **Network orchestration** – `packages/cli/src/internal/launcherCommon.ts` abstracts how to start different *foundations* (`chopsticks`, `zombie`, `dev`, `read_only`).  Each foundation has a handler in `lib/handlers/*Handler.ts` implementing a common interface.

• **Config loading** – `lib/configReader.ts` reads `moonwall.config.{json|yml|toml}`, validates it against the JSON schema generated from `@moonwall/types/src/config.ts` (see `packages/types/config_schema.json`).

• **Test execution** – `cmds/runTests.ts` spins up (or re-uses) a network, then calls Vitest programmatically, passing `--grep` etc.  CLI options are defined in `cmds/entrypoint.ts` and reuse helpers from `internal/commandParsers.ts`.

• **Context injection** – `packages/types/src/context.ts` defines the shape of the per-test `Context` (providers, chain data, helper fns).  Runtime values are created in `lib/runnerContext.ts` and exposed through Vitest’s `beforeAll` hooks.

• **EVM helpers** – `@moonwall/util` exposes chain constants (`constants/`), eth-tester class, JSON-RPC abstractions (`functions/ethers.ts`, `functions/web3.ts`, `functions/viem.ts`).

---

## 7. Developing / running locally (quick commands)

```bash
# install everything (Node 20+ required)
pnpm i

# build all packages
pnpm build

# type-check full repo
pnpm typecheck

# format & lint
pnpm fmt:fix && pnpm lint

# start interactive CLI (same as global `moonwall`)
pnpm start

# run the example test-suites against the default config
pnpm test
```

---

## 8. Tips for LLM Generated PRs

✔ Always run `pnpm fmt:fix` so Biome fixes formatting – CI will fail otherwise.  
✔ Remember that the repo is **ESM only**; do **not** introduce `require()` or CommonJS syntax.  
✔ Keep new external dependencies minimal and prefer existing ones listed earlier.  
✔ Place utility functions in `packages/util` unless they are CLI-specific.  
✔ Add/extend types in `packages/types` instead of sprinkling `any`.

❌ Do **not** commit generated `dist/` output – `build` script takes care of that.  
❌ Avoid editing files under `packages/**/dist` or `docs/public` – they are generated.

---

## 9. Glossary & short references

• **Foundation** – a strategy for acquiring a running Substrate network (chopsticks, zombie, dev, read_only).  
• **Environment** – user-named network preset defined in `moonwall.config` that picks one foundation and provides node parameters.  
• **Context** – object injected into each test containing providers, accounts, helper fns, etc.  
• **DescribeSuite / it** – thin wrappers around Vitest that enforce Moonwall’s metadata (`id`, `title`, etc.).

---

Happy hacking! ✨
