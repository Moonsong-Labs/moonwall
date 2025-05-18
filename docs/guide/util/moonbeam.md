# Moonbeam‐specific Helpers in `@moonwall/util`

While the generic helpers in [`@moonwall/util`](/guide/util/common) work on **any Substrate chain**, Moonbeam and its sister networks (Moonriver, Moonbase Alpha) expose *unique* precompiles, address formats and constants.  All of those are wrapped in the **`moonbeam` sub-module**.

```ts
import { PRECOMPILES, GLMR, isPrecompile } from "@moonwall/util/moonbeam";
```

The file lives at `packages/util/src/constants/chain.ts` – have a look for the exhaustive list.  Below is a condensed overview.

---

## 1 – Token units & fees

```ts
GLMR           // 1 000 000 000 000 000 000  (10^18)  – base unit
MILLIGLMR      // 1 000 000 000 000 000       (10^15)
MICROGLMR      // 1 000 000 000 000           (10^12)

WEIGHT_PER_SECOND = 1_000_000_000    // Substrate weight units
GAS_PER_SECOND    = 10_000_000_000   // EVM gas – 10x the weight constant

BLOCK_GAS_LIMIT   = 15_000_000       // Hard gas cap per block
```

The constants are used by high-level helpers like `context.estimateGas()` so you rarely import them directly – but they are handy for on-chain fee calculations in tests.

---

## 2 – Precompile addresses

| Name / Purpose                       | Address | Solidity ABI |
|--------------------------------------|---------|--------------|
| `PARACHAIN_STAKING` – delegate, etc. | `0x0000…0001` | [`parachain-staking/ParachainStaking.json`](https://github.com/Moonsong-Labs/moonwall/tree/main/test/contracts/out/precompiles/parachain-staking) |
| `ASSETS` – ERC-20 interface for PALLET | `0x0000…0002` | `assets/IERC20.json` |
| `CROWDLOAN_REWARDS`                  | `0x0000…0003` | *external* |

Import them via:

```ts
import { PRECOMPILES } from "@moonwall/util/moonbeam";

await context.ethers().readContract({
  address: PRECOMPILES.PARACHAIN_STAKING,
  abi: parachainStakingABI,
  functionName: "delegatorState",
  args: [ALITH]
});
```

The helper `isPrecompile(address)` quickly checks if an address falls into `0x0000…000F`.

---

## 3 – Chain timing helpers

Moonbeam uses a **12 s** block time and weighs blocks at **0.5000** weight‐per-second.  The util package exposes precalculated millisecond helpers:

```ts
SLOT_DURATION_MS = 12_000;
HOUR_MS          = 60 * 60 * 1_000;
DAY_MS           = 24 * HOUR_MS;
```

Use them together with `await context.fastForward(SLOT_DURATION_MS * 5)` to mine 5 empty blocks on a dev network.

---

## 4 – Runtime versions

The module defines **known runtime constants** so you can gate tests:

```ts
import { RUNTIME } from "@moonwall/util/moonbeam";

if (context.runtime().runtimeVersion >= RUNTIME.MOONBEAM_2302) {
  // new logic…
}
```

---

### Further reading

* [Moonbeam Docs](https://docs.moonbeam.network/) – Official developer portal.
* [Constants source code](https://github.com/Moonsong-Labs/moonwall/blob/main/packages/util/src/constants/chain.ts)

Enjoy building on the Beam! 🌖
