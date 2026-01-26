# Testing with Moonwall

## Writing Your First Test

Moonwall tests use `describeSuite` to define test suites, similar to Mocha/Jest. Import test utilities from `moonwall`:

```typescript
import { describeSuite, beforeAll, expect } from "moonwall";
```

### Test Suite Structure

```typescript
describeSuite({
  id: "D1",
  title: "Demo suite",
  foundationMethods: "dev",
  testCases: ({ it, context, log }) => {
    let api;
    const DUMMY_ACCOUNT = "0x11d88f59425cbc1867883fcf93614bf70e87E854";

    beforeAll(() => {
      api = context.polkadotJs();
    });

    it({
      id: "T1",
      title: "Transfer funds to empty account",
      test: async () => {
        const balanceBefore = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
        expect(balanceBefore.toString()).toEqual("0");

        await context.ethers().sendTransaction({
          to: DUMMY_ACCOUNT,
          value: "1000000000000000000" // 1 ETH in wei
        });
        await context.createBlock();

        const balanceAfter = (await api.query.system.account(DUMMY_ACCOUNT)).data.free;
        expect(balanceAfter.gt(balanceBefore)).toBe(true);
      }
    });
  }
});
```

### Key Components

- **`describeSuite`** - Defines a test suite with id, title, foundation type, and test cases
- **`foundationMethods`** - Must match your environment's foundation type (`dev`, `chopsticks`, `read_only`, `zombie`)
- **`context`** - Provides access to blockchain clients and utilities
- **`context.createBlock()`** - For dev foundation, triggers block production
- **`log()`** - Logs messages to test output

### Built-in Constants

Moonwall exports pre-funded development accounts and useful constants:

```typescript
import { alith, baltathar, GLMR } from "moonwall";
```

See [Context Functions](./write/context-functions) for the full API reference.

---

## Running Tests

### Via CLI Command

```bash
# Run all tests for an environment
pnpm moonwall test <environment-name>

# Run tests matching a pattern
pnpm moonwall test <environment-name> --pattern "transfer"
```

### Via Interactive Menu

```bash
pnpm moonwall
```

Select **Test Suite Execution**, then choose your environment.

### Handling Running Networks

If a network is already running, Moonwall offers three options:

1. **Kill processes and continue** - Stop existing network, start fresh
2. **Continue** - Use the existing network
3. **Abort** - Cancel test execution

---

## Debugging

### Log Levels

Set the `LOG_LEVEL` environment variable:

```bash
LOG_LEVEL=debug pnpm moonwall test dev_seq
```

Levels: `fatal`, `error`, `warn`, `info` (default), `debug`, `trace`, `silent`

### Print Test Logs

Use `--printlogs` to see test-specific logging:

```bash
pnpm moonwall test dev_seq --printlogs
```

### Tail Node Logs

For real-time debugging:

1. Run `pnpm moonwall`
2. Select **Network Launcher & Toolbox**
3. Choose your environment
4. Press any key, then select **Tail**

Key commands while tailing:
- **q** - Quit
- **t** - Run all tests
- **g** - Grep (run specific test)
- **p** - Pause tail

### Log File Location

Node logs are stored in `/tmp/node_logs` by default. The exact path is shown in console output when launching a network.

::: tip
Logs are overwritten on each network restart. Copy important logs before relaunching.
:::
