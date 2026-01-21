---
"@moonwall/cli": major
"@moonwall/types": major
"@moonwall/util": major
---

# Moonwall 6.0: Effect-TS Architecture & Bun Runtime Migration

This release represents a major architectural overhaul of Moonwall, introducing Effect-TS for robust async operations and migrating from pnpm/Vitest to Bun for improved performance.

## Breaking Changes

### Package Manager: pnpm → Bun

- **Installation**: Replace `pnpm install` with `bun install`
- **Scripts**: Replace `pnpm run` with `bun run`, `pnpm exec` with `bunx`
- **Lock file**: `pnpm-lock.yaml` replaced by `bun.lock`
- **Workspace config**: `pnpm-workspace.yaml` removed (Bun uses `workspaces` in package.json)

**Migration steps:**
```bash
# Remove old artifacts
rm -rf node_modules pnpm-lock.yaml

# Install with Bun
bun install

# Run commands
bun run build
bunx moonwall test <env>
```

### Test Runner: Vitest → Bun Test Runner

- **Test imports**: Change `import { describe, it, expect } from 'vitest'` to `import { describe, it, expect } from 'bun:test'`
- **Mocking**: Replace `vi.mock()` with `mock.module()` from `bun:test`
- **Spies**: Replace `vi.fn()` with `mock()`, `vi.spyOn()` with `spyOn()`
- **Test context**: Bun test callbacks use `() => void | Promise<void>` (no Vitest context parameter)

**Migration example:**
```typescript
// Before (Vitest)
import { describe, it, expect, vi } from 'vitest';
vi.mock('./module', () => ({ fn: vi.fn() }));

// After (Bun)
import { describe, it, expect, mock, spyOn } from 'bun:test';
mock.module('./module', () => ({ fn: mock(() => {}) }));
```

### Configuration Schema Changes

The following fields in `moonwall.config.json` have been renamed:

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `vitestArgs` | `bunTestArgs` | Bun test runner CLI arguments |
| `multiThreads` | `maxConcurrency` | Type simplified to `boolean \| number` |
| `printVitestOptions` | `printTestRunnerOptions` | Debug logging flag |
| `cacheImports` | *(deprecated)* | Bun handles bundling automatically |

**Configuration migration:**
```jsonc
// Before
{
  "environments": [{
    "vitestArgs": { "silent": true },
    "multiThreads": { "workers": 4, "pool": "threads" }
  }]
}

// After
{
  "environments": [{
    "bunTestArgs": { "silent": true },
    "maxConcurrency": 4
  }]
}
```

### Test Suite Exports

The `@moonwall/cli` package now exports test primitives from `bun:test` instead of Vitest:

```typescript
// These are re-exported from bun:test
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@moonwall/cli';
```

## New Features

### Effect-TS Service Architecture

Moonwall now uses Effect-TS for all async operations, providing:

- **Structured concurrency**: Proper resource management with automatic cleanup
- **Retry policies**: Exponential backoff with jitter for network operations
- **Timeout handling**: Configurable timeouts with user-friendly error messages
- **Tracing**: Optional span-based tracing (set `MOONWALL_TRACING=true`)
- **Structured errors**: Categorized errors with actionable suggestions

**Foundation services:**
- `DevFoundationService` - Local development node management
- `ChopsticksFoundationService` - Fork testing with Acala Chopsticks
- `ZombieFoundationService` - Multi-node network orchestration
- `ReadOnlyFoundationService` - Connection to existing networks

**Provider service:**
- Unified `ProviderService` for all blockchain client types (polkadotJs, ethers, viem, web3, papi)
- Connection retry with configurable attempts and timeouts
- Health check endpoints for each provider

### Health Check Endpoint

New `--health-port` option for `moonwall run` command:

```bash
moonwall run dev_seq --health-port 9999
```

Provides HTTP endpoints:
- `GET /health` - Full health status with nodes, providers, uptime
- `GET /ready` - Readiness probe for Kubernetes
- `GET /live` - Liveness probe for Kubernetes

### Input Validation

CLI commands now validate all inputs:
- Path traversal prevention for config files
- Environment name sanitization
- Download URL whitelist (GitHub domains only)
- Binary name validation

### Graceful Shutdown

Improved signal handling:
- `SIGINT` (Ctrl+C): Clean foundation shutdown, provider disconnect
- `SIGTERM`: Same cleanup with proper exit codes
- All child processes terminated on shutdown

## Performance Improvements

- **Faster test execution**: Bun's native test runner is significantly faster than Vitest
- **Parallel provider connections**: Providers connect concurrently using Effect.all
- **Memoized service initialization**: Effect layers are memoized for reuse
- **Lazy initialization**: Services initialize on first use with Effect.suspend

## Internal Changes

- Added `effect` ^3.19.8 and `@effect/platform` dependencies
- Added `bun-types` for TypeScript support
- Created comprehensive Effect Schema validation for config files
- Structured error logging with Cause.pretty
- Resource management with Effect.acquireRelease patterns
