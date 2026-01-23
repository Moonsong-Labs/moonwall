# Migration Guide: v5.x → v1.0.0

This guide covers migrating from the multi-package Moonwall (`@moonwall/cli`, `@moonwall/types`, `@moonwall/util`) to the unified `moonwall` package.

## Why the Change?

Moonwall has been consolidated from three separate packages into a single unified package. This simplifies installation, reduces dependency management overhead, and provides a cleaner developer experience.

## Quick Migration Steps

### 1. Update Dependencies

**Before (package.json):**
```json
{
  "dependencies": {
    "@moonwall/cli": "^5.18.2",
    "@moonwall/util": "^5.18.2",
    "@moonwall/types": "^5.18.2"
  }
}
```

**After (package.json):**
```json
{
  "dependencies": {
    "moonwall": "^1.0.0"
  }
}
```

Then run:
```bash
pnpm remove @moonwall/cli @moonwall/util @moonwall/types
pnpm add moonwall
```

### 2. Update Imports

All imports now come from a single `moonwall` package.

**Before:**
```typescript
import { describeSuite, beforeAll, expect } from "@moonwall/cli";
import { ALITH_ADDRESS, alith, GLMR, deployViemContract } from "@moonwall/util";
import type { DevModeContext, MoonwallConfig } from "@moonwall/types";
```

**After:**
```typescript
import {
  describeSuite,
  beforeAll,
  expect,
  ALITH_ADDRESS,
  alith,
  GLMR,
  deployViemContract,
} from "moonwall";
import type { DevModeContext, MoonwallConfig } from "moonwall";
```

### 3. Update Config Schema URL

If you're using the JSON schema for `moonwall.config.json` validation:

**Before:**
```json
{
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/packages/types/config_schema.json"
}
```

**After:**
```json
{
  "$schema": "https://raw.githubusercontent.com/Moonsong-Labs/moonwall/main/config_schema.json"
}
```

### 4. Update Global Installation (if applicable)

**Before:**
```bash
pnpm -g i @moonwall/cli
```

**After:**
```bash
pnpm -g i moonwall
```

## Import Mapping Reference

| Old Import | New Import |
|------------|------------|
| `@moonwall/cli` | `moonwall` |
| `@moonwall/util` | `moonwall` |
| `@moonwall/types` | `moonwall` |

All exports from the three packages are now available from the single `moonwall` package.

## Common Exports

### Test Functions
```typescript
import { describeSuite, beforeAll, afterAll, beforeEach, afterEach, expect } from "moonwall";
```

### Constants
```typescript
import {
  ALITH_ADDRESS, ALITH_PRIVATE_KEY, alith,
  BALTATHAR_ADDRESS, BALTATHAR_PRIVATE_KEY, baltathar,
  CHARLETH_ADDRESS, DOROTHY_ADDRESS,
  GLMR, PRECOMPILES,
} from "moonwall";
```

### Utilities
```typescript
import {
  deployViemContract,
  createViemTransaction,
  fetchCompiledContract,
  whiteListedTrack,
  customDevRpcRequest,
} from "moonwall";
```

### Types
```typescript
import type {
  DevModeContext,
  ChopsticksContext,
  ZombieContext,
  MoonwallConfig,
  Environment,
} from "moonwall";
```

## Troubleshooting

### TypeScript Errors After Migration

If you see TypeScript errors about missing exports, ensure you've:

1. Removed all old `@moonwall/*` packages
2. Cleared your `node_modules` and reinstalled: `rm -rf node_modules && pnpm i`
3. Restarted your TypeScript server/IDE

### Config Schema Validation Errors

Update the `$schema` URL in your `moonwall.config.json` as shown above.

## Need Help?

- [GitHub Issues](https://github.com/Moonsong-Labs/moonwall/issues)
- Email: info@moonsonglabs.com
