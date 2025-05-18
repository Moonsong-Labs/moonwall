# Context Helper Functions

Every test case receives a **`context` object** that hides the complexity of multiple RPC clients and foundations behind a clean API.  This page lists the most common helpers – the TypeScript types live in `packages/types/src/context.ts` for completions.

```ts
it({
  id: "TX-01",
  title: "transfer 1 GLMR via ethers",
  test: async ({ context, expect }) => {
    const ethers = context.ethers();

    await ethers.sendTransaction({ to: BOB, value: GLMR });
    await context.createBlock();

    expect(await ethers.getBalance(BOB)).toEqual(GLMR);
  }
});
```

---

## 1 – Provider accessors

| Method | Returns | Notes |
|--------|---------|-------|
| `context.polkadotJs(name?)` | `ApiPromise` | If you omit `name` Moonwall returns the **first** provider of type `polkadotJs`. |
| `context.ethers(name?)`    | `ethers.Wallet` | Wallet is already *connected* to the RPC specified in the provider config and funded with the default dev account. |
| `context.web3(name?)`      | `Web3` | Legacy EVM client – still useful for Truffle compat. |
| `context.viem(name?)`      | `ViemClient` | Super lightweight EVM calls. |
| `context.papi(name?)`      | `PolkadotClient` | Native Rust WS implementation (via `polkadot-api` WASM). |

All methods throw if the requested provider is **not defined** in the environment config.

---

## 2 – Block helpers

### `createBlock(callOrCalls?, options?)`

Produce a new block (or series of blocks) on foundations that support it (*dev*, *chopsticks*, *zombie*).  
If you pass **one or many extrinsics** Moonwall will include them in the block and resolve with execution info.

```ts
// bare – empty block
await context.createBlock();

// include a single extrinsic
await context.createBlock(api.tx.balances.transfer(BOB, GLMR));

// batch extrinsics & expect events
await context.createBlock([
  api.tx.democracy.notePreimage(hash),
  api.tx.democracy.propose(hash, 0)
], {
  expectEvents: [api.events.democracy.Started]
});
```

Options (see interface `BlockCreation`):

* `parentHash` – mine *on top* of a custom block.
* `finalize` – finalise immediately (default **true**).
* `allowFailures` – do not throw on `system.ExtrinsicFailed`.
* `signer` – specific signer for *all* extrinsics in this call.

### `fastForward(ms)` *(dev & zombie only)*

```ts
// forward 1 hour and mine the necessary blocks
await context.fastForward(60 * 60 * 1000);
```

---

## 3 – Utility helpers

| Helper | Description |
|--------|-------------|
| `context.runtime()` | Returns `{ runtimeName, runtimeVersion }` from chain metadata (read‐only foundation may disable this). |
| `context.waitForEvent(eventMatcher, timeout?)` | Resolves when an event appears in the system event queue. |
| `context.setHead(hash)` *(chopsticks only)* | Directly set the chain head – useful after runtime upgrade tests. |
| `context.accounts()` | Returns the list of *pre‐funded* dev accounts (ALITH, BALTATHAR, …). |
| `context.log(msg)` | Pipe a message into Moonwall’s central coloured logger. |

---

## 4 – Pattern examples

### 4.1 Governance happy path

```ts
import { openGovProposal, vote } from "@moonwall/cli/lib/governanceProcedures";

await openGovProposal(context, {
  call: api.tx.balances.transfer(CHARLETH, GLMR),
  deposit: GLMR.mul(10)
});

await vote(context, { aye: true, amount: GLMR.mul(100) });
await context.fastForward(DAY_MS * 4);
await context.createBlock();
```

### 4.2 Read precompile via ethers

```ts
const staking = new ethers.Contract(PRECOMPILES.PARACHAIN_STAKING, stakingABI, context.ethers());

expect(await staking.delegatorState(ALITH)).toMatchInlineSnapshot(`{ … }`);
```

---

### Further APIs

Scan the source folder [`packages/cli/src/lib`](https://github.com/Moonsong-Labs/moonwall/tree/main/packages/cli/src/lib) – any method that takes a `GenericContext` can be called from your tests!
