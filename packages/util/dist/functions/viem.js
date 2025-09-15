// src/functions/viem.ts
import { createWalletClient, hexToNumber, http } from "viem";
import { setTimeout as timer } from "timers/promises";
import { privateKeyToAccount } from "viem/accounts";

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

// src/functions/common.ts
import "@moonbeam-network/api-augment";
import { BN } from "@polkadot/util";
async function directRpcRequest(endpoint, method, params = [], timeoutMs = 1e4) {
  const data = {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  };
  if (endpoint.startsWith("ws")) {
    console.log("you've passed a websocket to fetch, is this intended?");
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const responseData = await response.json();
    if (responseData.error) {
      throw new Error(responseData.error.message);
    }
    return responseData.result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(
        `RPC request to ${endpoint} timed out after ${timeoutMs}ms (method: ${method})`
      );
    }
    throw error;
  }
}

// src/functions/viem.ts
async function getDevChain(url) {
  const httpUrl = url.replace("ws", "http");
  const block = { http: [httpUrl] };
  return {
    id: 1281,
    name: "Moonbeam Dev",
    nativeCurrency: {
      decimals: 18,
      name: "Glimmer",
      symbol: "GLMR",
    },
    rpcUrls: {
      public: block,
      default: block,
    },
  };
}
async function deriveViemChain(endpoint, maxRetries = 3) {
  const httpEndpoint = endpoint.replace("ws", "http");
  const block = { http: [httpEndpoint] };
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const id = hexToNumber(await directRpcRequest(httpEndpoint, "eth_chainId", []));
      const name = await directRpcRequest(httpEndpoint, "system_chain", []);
      const { tokenSymbol, tokenDecimals } = await directRpcRequest(
        httpEndpoint,
        "system_properties",
        []
      );
      return {
        id,
        name,
        nativeCurrency: {
          decimals: tokenDecimals,
          name: tokenSymbol,
          symbol: tokenSymbol,
        },
        rpcUrls: {
          public: block,
          default: block,
        },
      };
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        console.warn(
          `Failed to derive viem chain on attempt ${attempt}/${maxRetries}: ${error.message}. Retrying...`
        );
        await timer(1e3 * attempt);
      }
    }
  }
  throw new Error(
    `Failed to derive viem chain after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`
  );
}
async function deployViemContract(context, abi, bytecode, options) {
  const url = context.viem().transport.url;
  const { privateKey = ALITH_PRIVATE_KEY, ...rest } = options || {};
  const blob = {
    ...rest,
    abi,
    bytecode,
    account: privateKeyToAccount(privateKey),
  };
  const account = privateKeyToAccount(ALITH_PRIVATE_KEY);
  const client = createWalletClient({
    transport: http(url),
    account,
    chain: await deriveViemChain(url),
  });
  const hash = await client.deployContract(blob);
  await context.createBlock();
  for (let i = 0; i < 5; i++) {
    try {
      const { contractAddress, status, logs } = await context
        .viem()
        .getTransactionReceipt({ hash });
      return { contractAddress, status, logs, hash };
    } catch (e) {
      console.log(e.message);
      console.log("Contract deployment query, retrying...");
      await timer(100);
    }
  }
  throw new Error("Contract deployment query failed after 5 retries");
}
async function createRawTransfer(context, to, value, options) {
  const transferAmount = typeof value === "bigint" ? value : BigInt(value);
  return await createViemTransaction(context, {
    ...options,
    to,
    value: transferAmount,
  });
}
async function createViemTransaction(context, options) {
  const type = !!options && !!options.txnType ? options.txnType : "eip1559";
  const privateKey = !!options && !!options.privateKey ? options.privateKey : ALITH_PRIVATE_KEY;
  const account = privateKeyToAccount(privateKey);
  const value = options?.value ? options.value : 0n;
  const to = options?.to ? options.to : "0x0000000000000000000000000000000000000000";
  const chainId = await context.viem().getChainId();
  const txnCount = await context.viem().getTransactionCount({ address: account.address });
  const gasPrice = await context.viem().getGasPrice();
  const data = options?.data ? options.data : "0x";
  const estimatedGas =
    options.skipEstimation || options.gas !== void 0
      ? 1500000n
      : await context.viem().estimateGas({ account: account.address, to, value, data });
  const accessList = options?.accessList ? options.accessList : [];
  const txnBlob =
    type === "eip1559"
      ? {
          to,
          value,
          maxFeePerGas: options.maxFeePerGas !== void 0 ? options.maxFeePerGas : gasPrice,
          maxPriorityFeePerGas:
            options.maxPriorityFeePerGas !== void 0 ? options.maxPriorityFeePerGas : gasPrice,
          gas: options.gas !== void 0 ? options.gas : estimatedGas,
          nonce: options.nonce !== void 0 ? options.nonce : txnCount,
          data,
          chainId,
          type,
        }
      : type === "legacy"
        ? {
            to,
            value,
            gasPrice: options.gasPrice !== void 0 ? options.gasPrice : gasPrice,
            gas: options.gas !== void 0 ? options.gas : estimatedGas,
            nonce: options.nonce !== void 0 ? options.nonce : txnCount,
            data,
          }
        : type === "eip2930"
          ? {
              to,
              value,
              gasPrice: options.gasPrice !== void 0 ? options.gasPrice : gasPrice,
              gas: options.gas !== void 0 ? options.gas : estimatedGas,
              nonce: options.nonce !== void 0 ? options.nonce : txnCount,
              data,
              chainId,
              type,
            }
          : {};
  if (
    (type === "eip1559" && accessList.length > 0) ||
    (type === "eip2930" && accessList.length > 0)
  ) {
    txnBlob.accessList = accessList;
  }
  return await account.signTransaction(txnBlob);
}
async function checkBalance(context, account = ALITH_ADDRESS, block = "latest") {
  return typeof block === "string"
    ? await context.viem().getBalance({ address: account, blockTag: block })
    : typeof block === "bigint"
      ? await context.viem().getBalance({ address: account, blockNumber: block })
      : await context.viem().getBalance({ address: account });
}
async function sendRawTransaction(context, rawTx) {
  return await context.viem().request({ method: "eth_sendRawTransaction", params: [rawTx] });
}
export {
  checkBalance,
  createRawTransfer,
  createViemTransaction,
  deployViemContract,
  deriveViemChain,
  getDevChain,
  sendRawTransaction,
};
//# sourceMappingURL=viem.js.map
