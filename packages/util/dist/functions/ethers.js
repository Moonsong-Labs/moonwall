// src/functions/ethers.ts
import { Wallet } from "ethers";

// src/constants/accounts.ts
import "@moonbeam-network/api-augment";
import { Keyring } from "@polkadot/api";

// src/constants/chain.ts
import "@moonbeam-network/api-augment";
var DEBUG_MODE = process.env.DEBUG_MODE || false;
var DISPLAY_LOG = process.env.MOONBEAM_LOG || false;
var MOONBEAM_LOG = process.env.MOONBEAM_LOG || "info";
var BASE_PATH = process.env.BASE_PATH;
var CUSTOM_SPEC_PATH = process.env.CUSTOM_SPEC_PATH;
var BINARY_PATH = process.env.BINARY_PATH || "../target/release/moonbeam";
var RELAY_BINARY_PATH = process.env.RELAY_BINARY_PATH || "../target/release/polkadot";
var RELAY_LOG = process.env.RELAY_LOG;
var OVERRIDE_RUNTIME_PATH = process.env.OVERRIDE_RUNTIME_PATH || void 0;
var ETHAPI_CMD = process.env.ETHAPI_CMD || "";
var WASM_RUNTIME_OVERRIDES = process.env.WASM_RUNTIME_OVERRIDES || "";
var GLMR = 1000000000000000000n;
var DEFAULT_GENESIS_BALANCE = 2n ** 80n;
var DEFAULT_GENESIS_STAKING = 1000n * GLMR;
var DEFAULT_GENESIS_MAPPING = 100n * GLMR;
var PROPOSAL_AMOUNT = 1000n * GLMR;
var VOTE_AMOUNT = 10n * GLMR;
var MIN_GLMR_STAKING = 1000n * GLMR;
var MIN_GLMR_DELEGATOR = 1n * GLMR;
var WEIGHT_PER_SECOND = 1000000000000n;
var GAS_PER_SECOND = 40000000n;
var GAS_PER_WEIGHT = WEIGHT_PER_SECOND / GAS_PER_SECOND;
var GAS_PER_POV_BYTES = 4n;
var BLOCK_WEIGHT_LIMIT = WEIGHT_PER_SECOND / 2n;
var BLOCK_GAS_LIMIT = BLOCK_WEIGHT_LIMIT / GAS_PER_WEIGHT;
var EXTRINSIC_GAS_LIMIT = (BLOCK_GAS_LIMIT * 3n) / 4n - BLOCK_GAS_LIMIT / 10n;
var MAX_BLOCK_DEV_POV = 4 * 1024 * 1024 + 512;
var MAX_ETH_POV_PER_TX = EXTRINSIC_GAS_LIMIT / GAS_PER_POV_BYTES;
var EXTRINSIC_BASE_WEIGHT = 25e7;
var WEIGHT_PER_GAS = 1000000000000n / 40000000n;
var MINUTES = 60 / 12;
var HOURS = MINUTES * 60;
var DAYS = HOURS * 24;
var TWO_MINS = 2 * 60 * 1e3;
var FIVE_MINS = 5 * 60 * 1e3;
var TEN_MINS = 10 * 60 * 1e3;
var THIRTY_MINS = 30 * 60 * 1e3;
var ONE_HOURS = 60 * 60 * 1e3;
var TWO_HOURS = 2 * 60 * 60 * 1e3;
var THREE_HOURS = 3 * 60 * 60 * 1e3;
var FOUR_HOURS = 4 * 60 * 60 * 1e3;
var MAX_BLOCK_WEIGHT = 5e11;
var TARGET_FILL_AMOUNT =
  ((MAX_BLOCK_WEIGHT * 0.75 * 0.25 - EXTRINSIC_BASE_WEIGHT) / MAX_BLOCK_WEIGHT) * 1e9;
var TARGET_FILL_PERMILL = 0.25 * 1e6;
var WEIGHT_FEE = 50n * 1000n;

// src/constants/accounts.ts
var keyringEth = new Keyring({ type: "ethereum" });
var keyringEd25519 = new Keyring({ type: "ed25519" });
var keyringSr25519 = new Keyring({ type: "sr25519" });
var ALITH_ADDRESS = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";
var ALITH_PRIVATE_KEY = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";
var BALTATHAR_PRIVATE_KEY = "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b";
var CHARLETH_PRIVATE_KEY = "0x0b6e18cafb6ed99687ec547bd28139cafdd2bffe70e6b688025de6b445aa5c5b";
var DOROTHY_PRIVATE_KEY = "0x39539ab1876910bbf3a223d84a29e28f1cb4e2e456503e7e91ed39b2e7223d68";
var ETHAN_PRIVATE_KEY = "0x7dce9bc8babb68fec1409be38c8e1a52650206a7ed90ff956ae8a6d15eeaaef4";
var FAITH_PRIVATE_KEY = "0xb9d2ea9a615f3165812e8d44de0d24da9bbd164b65c4f0573e1ce2c8dbd9c8df";
var GOLIATH_PRIVATE_KEY = "0x96b8a38e12e1a31dee1eab2fffdf9d9990045f5b37e44d8cc27766ef294acf18";
var GERALD_PRIVATE_KEY = "0x99B3C12287537E38C90A9219D4CB074A89A16E9CDB20BF85728EBD97C343E342";
var ALITH_GENESIS_FREE_BALANCE = DEFAULT_GENESIS_BALANCE - DEFAULT_GENESIS_MAPPING;
var ALITH_GENESIS_LOCK_BALANCE = DEFAULT_GENESIS_STAKING;
var ALITH_GENESIS_TRANSFERABLE_BALANCE = ALITH_GENESIS_FREE_BALANCE - ALITH_GENESIS_LOCK_BALANCE;
var alith = keyringEth.addFromUri(ALITH_PRIVATE_KEY);
var baltathar = keyringEth.addFromUri(BALTATHAR_PRIVATE_KEY);
var charleth = keyringEth.addFromUri(CHARLETH_PRIVATE_KEY);
var dorothy = keyringEth.addFromUri(DOROTHY_PRIVATE_KEY);
var ethan = keyringEth.addFromUri(ETHAN_PRIVATE_KEY);
var faith = keyringEth.addFromUri(FAITH_PRIVATE_KEY);
var goliath = keyringEth.addFromUri(GOLIATH_PRIVATE_KEY);
var gerald = keyringEth.addFromUri(GERALD_PRIVATE_KEY);

// src/functions/ethers.ts
var transactionHandlers = {
  legacy: (blob, params) => {
    blob.gasPrice = params.gasPrice || "10000000000";
    blob.gasLimit = params.gasLimit || "200000";
    blob.type = 0;
  },
  eip2930: (blob, params) => {
    blob.gasPrice = params.gasPrice || "10000000000";
    blob.gasLimit = params.gasLimit || "200000";
    blob.accessList = params.accessList || [];
    blob.type = 1;
  },
  eip1559: (blob, params) => {
    blob.accessList = params.accessList || [];
    blob.maxFeePerGas = params.maxFeePerGas || "10000000000";
    blob.maxPriorityFeePerGas = params.maxPriorityFeePerGas || 0;
    blob.gasLimit = params.gasLimit || "200000";
    blob.type = 2;
  },
};
async function createEthersTransaction(context, params) {
  const nonce =
    "nonce" in params
      ? params.nonce
      : await context.viem().getTransactionCount({ address: ALITH_ADDRESS });
  const blob = { nonce, ...params };
  const handler = transactionHandlers[params.txnType || "legacy"];
  if (!handler) {
    throw new Error("Unknown transaction type, update createRawEthersTxn fn");
  }
  handler(blob, params);
  const signer = params.privateKey
    ? new Wallet(params.privateKey, context.ethers().provider)
    : context.ethers();
  const txn = await signer.populateTransaction(blob);
  return await signer.signTransaction(txn);
}
export { createEthersTransaction };
//# sourceMappingURL=ethers.js.map
