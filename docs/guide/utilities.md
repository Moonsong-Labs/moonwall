# Utilities

Moonwall includes a suite of constants, functions, and types that are useful when writing tests. Import them directly from `moonwall`.

## Pre-funded Accounts

Development accounts pre-funded with tokens for testing:

```typescript
import { alith, baltathar, charleth, dorothy, ethan, faith, gerald, goliath } from "moonwall";
```

- **Alith, Baltathar, etc.** - EVM-compatible accounts (20-byte Account20 format)
- These are the EVM versions of the standard Substrate accounts (Alice, Bob, etc.)

## Token Constants

```typescript
import { GLMR, MILLIGLMR, MICROGLMR } from "moonwall";

// GLMR = 10^18 (same precision as ETH)
const oneToken = 1n * GLMR;
const halfToken = 500n * MILLIGLMR;
```

Additional constants:
- `DEFAULT_GENESIS_BALANCE` - Default balance for genesis accounts
- `DEFAULT_GENESIS_STAKING` - Default staking amount
- `MIN_GLMR_STAKING` - Minimum collator staking requirement
- `MIN_GLMR_DELEGATOR` - Minimum delegator staking requirement

## Gas and Weight Constants

```typescript
import {
  WEIGHT_PER_SECOND,
  GAS_PER_SECOND,
  BLOCK_GAS_LIMIT,
  EXTRINSIC_GAS_LIMIT,
  MIN_GAS_PRICE
} from "moonwall";
```

## Precompile Addresses

For Moonbeam networks:

```typescript
import {
  PRECOMPILE_PARACHAIN_STAKING_ADDRESS,
  PRECOMPILE_NATIVE_ERC20_ADDRESS,
  PRECOMPILE_BATCH_ADDRESS,
  PRECOMPILE_DEMOCRACY_ADDRESS,
  // ... and more
} from "moonwall";
```

---

## Contract Utilities

### `getCompiled<TAbi>(contractPath: string)`

Load a compiled contract JSON file:

```typescript
import { getCompiled } from "moonwall";

const compiled = getCompiled("./contracts/MyContract");
// Returns: { abi, bytecode, ... }
```

### `getAllCompiledContracts(contractsDir?, recurse?)`

List all compiled contract names in a directory:

```typescript
import { getAllCompiledContracts } from "moonwall";

const contracts = getAllCompiledContracts("./contracts", true);
// Returns: ["MyContract", "AnotherContract", ...]
```

---

## Block Utilities

### `createAndFinalizeBlock(api, parentHash?, finalize?)`

Create a new block (for manual seal nodes):

```typescript
import { createAndFinalizeBlock } from "moonwall";

const { hash, duration, proofSize } = await createAndFinalizeBlock(api);
```

### `getBlockExtrinsic(api, blockHash, section, method)`

Find a specific extrinsic in a block:

```typescript
import { getBlockExtrinsic } from "moonwall";

const { extrinsic, events, resultEvent } = await getBlockExtrinsic(
  api,
  blockHash,
  "balances",
  "transfer"
);
```

### `calculateFeePortions(amount)`

Calculate how fees are split between burn (80%) and treasury (20%):

```typescript
import { calculateFeePortions } from "moonwall";

const { burnt, treasury } = calculateFeePortions(100n * GLMR);
```

---

## Extrinsic Utilities

### `signAndSend(tx, account?, nonce?)`

Sign and send a transaction, waiting for finalization:

```typescript
import { signAndSend, alith } from "moonwall";

await signAndSend(api.tx.balances.transfer(dest, amount), alith);
```

---

## Artifact Downloader

Download node binaries directly from the CLI:

```bash
# Via command
pnpm moonwall download <artifact> <version> [path]

# Examples
pnpm moonwall download moonbeam latest ./tmp
pnpm moonwall download polkadot v1.5.0 ./bin
```

Or via the interactive menu: select **Artifact Downloader** from the main menu.

### Supported Networks

- Moonbeam
- Polkadot
- Tanssi

### Adding Custom Networks

Create a repo definition file in `src/cli/lib/repoDefinitions/`:

```typescript
import type { RepoSpec } from "moonwall";

const repo: RepoSpec = {
  name: "tanssi",
  binaries: [
    { name: "tanssi-node", defaultArgs: ["--dev", "--sealing=manual"] },
    { name: "container-chain-template-simple-node" },
  ],
  ghAuthor: "moondance-labs",
  ghRepo: "tanssi",
};
export default repo;
```

### Download Command Options

| Option | Description |
|--------|-------------|
| `name` | Artifact name to download |
| `version` | Version to download (e.g., `latest`, `v1.5.0`) |
| `path` | Destination directory (default: current directory) |
| `--overwrite`, `-d` | Overwrite existing files (default: true) |
| `--output-name`, `-o` | Rename the downloaded file |
