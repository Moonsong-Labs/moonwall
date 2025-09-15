// src/index.ts
import "@moonbeam-network/api-augment";

// src/classes/eth-tester.ts
import { ContractFactory } from "ethers";
var DEFAULT_TRANSACTION = {};
var EthTester = class {
  /**
   * @name defaultType: Default type of Ethereum transaction
   */
  defaultType;
  /**
   * @name defaultType: Default account to sign Ethereum transactions (usually sudo account)
   */
  defaultAccount;
  /**
   * @name logger: Logger to use
   */
  logger;
  /**
   * @name web3: Web3 instance
   */
  web3;
  /**
   * @name constructor
   * @param web3: Web3 instance
   * @param privateKey: Private key of the default account
   * @param logger: Logger to use
   * @param type: Default type of Ethereum transaction
   * @returns Web3Tester instance
   * @description Creates a new Web3Tester instance
   * @example
   * const web3 = new Web3("http://localhost:9944");
   * const web3Tester = new Web3Tester(web3, alith.privateKey, logger, "EIP1559");
   * const rawTransaction = await web3Tester.genSignedTransfer({
   *  to: baltathar.address,
   *  value: web3.utils.toWei("1", "ether"),
   * });
   */
  constructor(web3, privateKey, logger2, type = "Legacy") {
    this.web3 = web3;
    this.logger = logger2;
    this.defaultType = type;
    this.defaultAccount = web3.eth.accounts.privateKeyToAccount(privateKey);
  }
  /**
   * @name genSignedTransaction
   * @param options: Transaction options
   * @param txType: Type of Ethereum transaction
   * @returns Signed transaction
   * @description Generates a signed Ethereum transaction
   * @example
   * const rawTransaction = await web3Tester.genSignedTransaction({
   *   to: baltathar.address,
   *   to: authorMapping.address,
   *   data: authorMapping.encodeFunctionData("setKeys", [keys]),
   * });
   */
  genSignedTransaction = async (options = DEFAULT_TRANSACTION, txType) => {
    const type = txType || this.defaultType;
    const isLegacy = type === "Legacy";
    const isEip2930 = type === "EIP2930";
    const isEip1559 = type === "EIP1559";
    if (options.gasPrice && options.maxFeePerGas) {
      throw new Error("txn has both gasPrice and maxFeePerGas!");
    }
    if (options.gasPrice && options.maxPriorityFeePerGas) {
      throw new Error("txn has both gasPrice and maxPriorityFeePerGas!");
    }
    if (typeof options.gasPrice === "bigint") {
      options.gasPrice = `0x${options.gasPrice.toString(16)}`;
    }
    if (typeof options.maxFeePerGas === "bigint") {
      options.maxFeePerGas = `0x${options.maxFeePerGas.toString(16)}`;
    }
    if (typeof options.maxPriorityFeePerGas === "bigint") {
      options.maxPriorityFeePerGas = `0x${options.maxPriorityFeePerGas.toString(16)}`;
    }
    let maxFeePerGas;
    let maxPriorityFeePerGas;
    if (options.gasPrice) {
      maxFeePerGas = options.gasPrice;
      maxPriorityFeePerGas = options.gasPrice;
    } else {
      maxFeePerGas = options.maxFeePerGas || BigInt(await this.web3.eth.getGasPrice());
      maxPriorityFeePerGas = options.maxPriorityFeePerGas || 0;
    }
    const gasPrice =
      options.gasPrice !== void 0
        ? options.gasPrice
        : `0x${BigInt(await this.web3.eth.getGasPrice()).toString(16)}`;
    const value = options.value !== void 0 ? options.value : "0x00";
    const from = options.from || this.defaultAccount.address;
    const privateKey =
      options.privateKey !== void 0 ? options.privateKey : this.defaultAccount.privateKey;
    let error;
    const estimatedGas = await this.web3.eth
      .estimateGas({
        from,
        to: options.to,
        data: options.data,
      })
      .catch((e) => {
        error = e;
        return 0;
      });
    const gas = options.gas || estimatedGas;
    const accessList = options.accessList || [];
    const nonce =
      options.nonce != null
        ? options.nonce
        : await this.web3.eth.getTransactionCount(from, "pending");
    let data;
    let rawTransaction;
    if (isLegacy) {
      data = {
        from,
        to: options.to,
        value: value?.toString(),
        gasPrice,
        gas,
        nonce,
        data: options.data,
      };
      const tx = await this.web3.eth.accounts.signTransaction(data, privateKey);
      rawTransaction = tx.rawTransaction;
    } else {
      const chainId = await this.web3.eth.getChainId();
      if (isEip2930) {
        data = {
          from,
          to: options.to,
          value: value?.toString(),
          gasPrice,
          gasLimit: gas,
          nonce,
          data: options.data,
          accessList,
          chainId,
          type: 1,
        };
      } else if (isEip1559) {
        data = {
          from,
          to: options.to,
          value: value?.toString(),
          maxFeePerGas,
          maxPriorityFeePerGas,
          gasLimit: gas,
          nonce,
          data: options.data,
          accessList,
          chainId,
          type: 2,
        };
      }
      const tx = await this.web3.eth.accounts.signTransaction(data, privateKey);
      rawTransaction = tx.rawTransaction;
    }
    this.logger.debug(
      `Tx [${/:([0-9]+)$/.exec(this.web3.currentProvider.host)?.[1]}] from: ${`${data.from.substr(0, 5)}...${data.from.substr(data.from.length - 3)}`}, ${data.to ? `to: ${`${data.to.substr(0, 5)}...${data.to.substr(data.to.length - 3)}`}, ` : ""}${data.value ? `value: ${data.value.toString()}, ` : ""}${data.gasPrice ? `gasPrice: ${data.gasPrice.toString()}, ` : ""}${data.maxFeePerGas ? `maxFeePerGas: ${data.maxFeePerGas.toString()}, ` : ""}${data.maxPriorityFeePerGas ? `maxPriorityFeePerGas: ${data.maxPriorityFeePerGas.toString()}, ` : ""}${data.accessList ? `accessList: ${data.accessList.toString()}, ` : ""}${data.gas ? `gas: ${data.gas.toString()}, ` : ""}${data.nonce ? `nonce: ${data.nonce.toString()}, ` : ""}${!data.data ? "" : `data: ${data.data.length < 50 ? data.data : `${data.data.substr(0, 5)}...${data.data.substr(data.data.length - 3)}`}, `}${error ? `ERROR: ${error.toString()}, ` : ""}`
    );
    return rawTransaction;
  };
  /**
   * @name genSignedTransfer
   * @param to Address of the recipient
   * @param value Amount of Wei to send
   * @param options Transaction options
   * @description Generates a signed Ethereum transactiosn
   * @returns Signed transaction
   */
  genSignedTransfer = async (to, value, options = DEFAULT_TRANSACTION) => {
    return await this.genSignedTransaction({
      ...options,
      value: value.toString(),
      to,
    });
  };
  /**
   * @name genSignedContractDeployment
   * @description Generates a signed contract deployment transaction
   * @param contractCreation Contract creation object
   * @param options Transaction options
   * @returns Signed transaction
   */
  genSignedContractDeployment = async (contractCreation, options = DEFAULT_TRANSACTION) => {
    const factory = new ContractFactory(contractCreation.abi, contractCreation.byteCode);
    return await this.genSignedTransaction({
      ...options,
      data: (await factory.getDeployTransaction(...(contractCreation.arguments || []))).data,
    });
  };
  /**
   * @name sendSignedTransaction
   * @description Sends a signed transaction, without waiting for it to be produced.
   * @param rawTransaction Signed transaction
   * @returns Transaction JSON RPC response
   */
  sendSignedTransaction = async (rawTransaction) => {
    return new Promise(async (resolve, reject) => {
      try {
        if (typeof this.web3.currentProvider === "string") {
          reject("Web3 provider is not a valid provider");
          return;
        }
        this.web3.currentProvider.send(
          {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_sendRawTransaction",
            params: [await rawTransaction],
          },
          (error, result) => {
            if (error) {
              reject(`Failed to send signed transaction: ${error.message || error.toString()}`);
            }
            resolve(result);
          }
        );
      } catch (e) {
        reject(e);
      }
    });
  };
};

// src/constants/accounts.ts
import "@moonbeam-network/api-augment";
import { Keyring } from "@polkadot/api";

// src/constants/chain.ts
import "@moonbeam-network/api-augment";
var SPECS_PATH = "./moonbeam-test-specs";
var DEBUG_MODE = process.env.DEBUG_MODE || false;
var DISPLAY_LOG = process.env.MOONBEAM_LOG || false;
var MOONBEAM_LOG = process.env.MOONBEAM_LOG || "info";
var BASE_PATH = process.env.BASE_PATH;
var CUSTOM_SPEC_PATH = process.env.CUSTOM_SPEC_PATH;
var BINARY_PATH = process.env.BINARY_PATH || "../target/release/moonbeam";
var RELAY_BINARY_PATH = process.env.RELAY_BINARY_PATH || "../target/release/polkadot";
var RELAY_LOG = process.env.RELAY_LOG;
var OVERRIDE_RUNTIME_PATH = process.env.OVERRIDE_RUNTIME_PATH || void 0;
var SPAWNING_TIME = 2e4;
var ETHAPI_CMD = process.env.ETHAPI_CMD || "";
var WASM_RUNTIME_OVERRIDES = process.env.WASM_RUNTIME_OVERRIDES || "";
var RELAY_CHAIN_NODE_NAMES = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Ferdie", "One"];
var ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
var TREASURY_ACCOUNT = "0x6d6f646c70632f74727372790000000000000000";
var GLMR = 1000000000000000000n;
var MILLIGLMR = 1000000000000000n;
var MICROGLMR = 1000000000000n;
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
var MIN_GAS_PRICE = 10000000000n;
var GAS_LIMIT_POV_RATIO = 4;
var PRECOMPILE_PARACHAIN_STAKING_ADDRESS = "0x0000000000000000000000000000000000000800";
var PRECOMPILE_CROWDLOAN_REWARDS_ADDRESS = "0x0000000000000000000000000000000000000801";
var PRECOMPILE_NATIVE_ERC20_ADDRESS = "0x0000000000000000000000000000000000000802";
var PRECOMPILE_DEMOCRACY_ADDRESS = "0x0000000000000000000000000000000000000803";
var PRECOMPILE_XTOKENS_ADDRESS = "0x0000000000000000000000000000000000000804";
var PRECOMPILE_RELAY_ENCODER_ADDRESS = "0x0000000000000000000000000000000000000805";
var PRECOMPILE_XCM_TRANSACTOR_ADDRESS_V1 = "0x0000000000000000000000000000000000000806";
var PRECOMPILE_AUTHOR_MAPPING_ADDRESS = "0x0000000000000000000000000000000000000807";
var PRECOMPILE_BATCH_ADDRESS = "0x0000000000000000000000000000000000000808";
var PRECOMPILE_RANDOMNESS_ADDRESS = "0x0000000000000000000000000000000000000809";
var PRECOMPILE_CALL_PERMIT_ADDRESS = "0x000000000000000000000000000000000000080a";
var PRECOMPILE_PROXY_ADDRESS = "0x000000000000000000000000000000000000080b";
var PRECOMPILE_XCM_UTILS_ADDRESS = "0x000000000000000000000000000000000000080c";
var PRECOMPILE_XCM_TRANSACTOR_ADDRESS_V2 = "0x000000000000000000000000000000000000080d";
var PRECOMPILE_COUNCIL_ADDRESS = "0x000000000000000000000000000000000000080e";
var PRECOMPILE_TECH_COMMITTEE_ADDRESS = "0x000000000000000000000000000000000000080f";
var PRECOMPILE_TREASURY_COUNCIL_ADDRESS = "0x0000000000000000000000000000000000000810";
var PRECOMPILE_DISPATCH_ADDRESS = "0x0000000000000000000000000000000000000401";
var PRECOMPILE_REFERENDA_ADDRESS = "0x0000000000000000000000000000000000000811";
var PRECOMPILE_CONVICTION_VOTING_ADDRESS = "0x0000000000000000000000000000000000000812";
var PRECOMPILE_PREIMAGE_ADDRESS = "0x0000000000000000000000000000000000000813";
var PRECOMPILE_OPEN_TECH_COMMITTEE_ADDRESS = "0x0000000000000000000000000000000000000814";
var PRECOMPILE_GMP_ADDRESS = "0x0000000000000000000000000000000000000816";
var PRECOMPILES = {
  ParachainStaking: "0x0000000000000000000000000000000000000800",
  CrowdloanRewards: "0x0000000000000000000000000000000000000801",
  NativeErc20: ["0x0000000000000000000000000000000000000802", "IERC20"],
  Democracy: "0x0000000000000000000000000000000000000803",
  Xtokens: "0x0000000000000000000000000000000000000804",
  RelayEncoder: "0x0000000000000000000000000000000000000805",
  XcmTransactorV1: "0x0000000000000000000000000000000000000806",
  AuthorMapping: "0x0000000000000000000000000000000000000807",
  Batch: "0x0000000000000000000000000000000000000808",
  Randomness: "0x0000000000000000000000000000000000000809",
  CallPermit: "0x000000000000000000000000000000000000080a",
  Proxy: "0x000000000000000000000000000000000000080b",
  XcmUtils: "0x000000000000000000000000000000000000080c",
  XcmTransactorV2: "0x000000000000000000000000000000000000080d",
  Council: ["0x000000000000000000000000000000000000080e", "Collective"],
  TechCommittee: ["0x000000000000000000000000000000000000080f", "Collective"],
  TreasuryCouncil: ["0x0000000000000000000000000000000000000810", "Collective"],
  // DISPATCH: "0x0000000000000000000000000000000000000401",
  Referenda: "0x0000000000000000000000000000000000000811",
  ConvictionVoting: "0x0000000000000000000000000000000000000812",
  Preimage: "0x0000000000000000000000000000000000000813",
  // OpenTechCommittee: "0x0000000000000000000000000000000000000814",
  Gmp: "0x0000000000000000000000000000000000000816",
};
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
var CONTRACT_RANDOMNESS_STATUS_DOES_NOT_EXISTS = 0;
var CONTRACT_RANDOMNESS_STATUS_PENDING = 1;
var CONTRACT_RANDOMNESS_STATUS_READY = 2;
var CONTRACT_RANDOMNESS_STATUS_EXPIRED = 3;
var CONTRACT_PROXY_TYPE_ANY = 0;
var CONTRACT_PROXY_TYPE_NON_TRANSFER = 1;
var CONTRACT_PROXY_TYPE_GOVERNANCE = 2;
var CONTRACT_PROXY_TYPE_STAKING = 3;
var CONTRACT_PROXY_TYPE_CANCEL_PROXY = 4;
var CONTRACT_PROXY_TYPE_BALANCES = 5;
var CONTRACT_PROXY_TYPE_AUTHOR_MAPPING = 6;
var CONTRACT_PROXY_TYPE_IDENTITY_JUDGEMENT = 7;
var MAX_BLOCK_WEIGHT = 5e11;
var TARGET_FILL_AMOUNT =
  ((MAX_BLOCK_WEIGHT * 0.75 * 0.25 - EXTRINSIC_BASE_WEIGHT) / MAX_BLOCK_WEIGHT) * 1e9;
var TARGET_FILL_PERMILL = 0.25 * 1e6;
var WEIGHT_FEE = 50n * 1000n;
var RUNTIME_CONSTANTS = {
  MOONBASE: {
    MIN_FEE_MULTIPLIER: "100000000000000000",
    MAX_FEE_MULTIPLIER: "100000000000000000000000",
    MIN_BASE_FEE_IN_WEI: "125000000",
    MAX_BASE_FEE_IN_WEI: "125000000000000",
  },
  MOONRIVER: {
    MIN_FEE_MULTIPLIER: "1000000000000000000",
    MAX_FEE_MULTIPLIER: "100000000000000000000000",
    MIN_BASE_FEE_IN_WEI: "1250000000",
    MAX_BASE_FEE_IN_WEI: "125000000000000",
  },
  MOONBEAM: {
    MIN_FEE_MULTIPLIER: "1000000000000000000",
    MAX_FEE_MULTIPLIER: "100000000000000000000000",
    MIN_BASE_FEE_IN_WEI: "125000000000",
    MAX_BASE_FEE_IN_WEI: "12500000000000000",
  },
};
var DUMMY_REVERT_BYTECODE = "0x60006000fd";

// src/constants/accounts.ts
var keyringEth = new Keyring({ type: "ethereum" });
var keyringEd25519 = new Keyring({ type: "ed25519" });
var keyringSr25519 = new Keyring({ type: "sr25519" });
var ALITH_ADDRESS = "0xf24FF3a9CF04c71Dbc94D0b566f7A27B94566cac";
var ALITH_PRIVATE_KEY = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";
var ALITH_SESSION_ADDRESS = "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d";
var ALITH_CONTRACT_ADDRESSES = [
  "0xc01Ee7f10EA4aF4673cFff62710E1D7792aBa8f3",
  "0x970951a12F975E6762482ACA81E57D5A2A4e73F4",
  "0x3ed62137c5DB927cb137c26455969116BF0c23Cb",
  "0x962c0940d72E7Db6c9a5F81f1cA87D8DB2B82A23",
  "0x5CC307268a1393AB9A764A20DACE848AB8275c46",
  "0xeAB4eEBa1FF8504c124D031F6844AD98d07C318f",
];
var BALTATHAR_ADDRESS = "0x3Cd0A705a2DC65e5b1E1205896BaA2be8A07c6e0";
var BALTATHAR_PRIVATE_KEY = "0x8075991ce870b93a8870eca0c0f91913d12f47948ca0fd25b49c6fa7cdbeee8b";
var BALTATHAR_SESSION_ADDRESS =
  "0x8eaf04151687736326c9fea17e25fc5287613693c912909cb226aa4794f26a48";
var CHARLETH_ADDRESS = "0x798d4Ba9baf0064Ec19eB4F0a1a45785ae9D6DFc";
var CHARLETH_PRIVATE_KEY = "0x0b6e18cafb6ed99687ec547bd28139cafdd2bffe70e6b688025de6b445aa5c5b";
var CHARLETH_SESSION_ADDRESS = "0x90b5ab205c6974c9ea841be688864633dc9ca8a357843eeacf2314649965fe22";
var DOROTHY_ADDRESS = "0x773539d4Ac0e786233D90A233654ccEE26a613D9";
var DOROTHY_PRIVATE_KEY = "0x39539ab1876910bbf3a223d84a29e28f1cb4e2e456503e7e91ed39b2e7223d68";
var ETHAN_ADDRESS = "0xFf64d3F6efE2317EE2807d223a0Bdc4c0c49dfDB";
var ETHAN_PRIVATE_KEY = "0x7dce9bc8babb68fec1409be38c8e1a52650206a7ed90ff956ae8a6d15eeaaef4";
var FAITH_ADDRESS = "0xC0F0f4ab324C46e55D02D0033343B4Be8A55532d";
var FAITH_PRIVATE_KEY = "0xb9d2ea9a615f3165812e8d44de0d24da9bbd164b65c4f0573e1ce2c8dbd9c8df";
var GOLIATH_ADDRESS = "0x7BF369283338E12C90514468aa3868A551AB2929";
var GOLIATH_PRIVATE_KEY = "0x96b8a38e12e1a31dee1eab2fffdf9d9990045f5b37e44d8cc27766ef294acf18";
var GERALD_ADDRESS = "0x6Be02d1d3665660d22FF9624b7BE0551ee1Ac91b";
var GERALD_PRIVATE_KEY = "0x99B3C12287537E38C90A9219D4CB074A89A16E9CDB20BF85728EBD97C343E342";
var GERALD_CONTRACT_ADDRESSES = [
  "0xC2Bf5F29a4384b1aB0C063e1c666f02121B6084a",
  "0x5c4242beB94dE30b922f57241f1D02f36e906915",
  "0x42e2EE7Ba8975c473157634Ac2AF4098190fc741",
  "0xF8cef78E923919054037a1D03662bBD884fF4edf",
  "0xe573BCA813c741229ffB2488F7856C6cAa841041",
  "0xBb0CC0fb3e0c06725c67167501f850B4900D6DB5",
];
var ALITH_GENESIS_FREE_BALANCE = DEFAULT_GENESIS_BALANCE - DEFAULT_GENESIS_MAPPING;
var ALITH_GENESIS_LOCK_BALANCE = DEFAULT_GENESIS_STAKING;
var ALITH_GENESIS_RESERVE_BALANCE = DEFAULT_GENESIS_MAPPING;
var ALITH_GENESIS_TRANSFERABLE_BALANCE = ALITH_GENESIS_FREE_BALANCE - ALITH_GENESIS_LOCK_BALANCE;
var alith = keyringEth.addFromUri(ALITH_PRIVATE_KEY);
var baltathar = keyringEth.addFromUri(BALTATHAR_PRIVATE_KEY);
var charleth = keyringEth.addFromUri(CHARLETH_PRIVATE_KEY);
var dorothy = keyringEth.addFromUri(DOROTHY_PRIVATE_KEY);
var ethan = keyringEth.addFromUri(ETHAN_PRIVATE_KEY);
var faith = keyringEth.addFromUri(FAITH_PRIVATE_KEY);
var goliath = keyringEth.addFromUri(GOLIATH_PRIVATE_KEY);
var gerald = keyringEth.addFromUri(GERALD_PRIVATE_KEY);
var accountSeed = 1e4;
function generateKeyringPair(type = "ethereum", privateKey) {
  const key = privateKey || `0xDEADBEEF${(accountSeed++).toString(16).padStart(56, "0")}`;
  if (type === "sr25519") {
    return keyringSr25519.addFromUri(key);
  }
  if (type === "ed25519") {
    return keyringEd25519.addFromUri(key);
  }
  return keyringEth.addFromUri(key);
}

// src/constants/smartContract.ts
var xcAssetAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "owner",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "spender",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Approval",
    type: "event",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "address", name: "from", type: "address" },
      { indexed: true, internalType: "address", name: "to", type: "address" },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  },
  {
    inputs: [
      { internalType: "address", name: "owner", type: "address" },
      { internalType: "address", name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "who", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "name",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "symbol",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalSupply",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "address", name: "from", type: "address" },
      { internalType: "address", name: "to", type: "address" },
      { internalType: "uint256", name: "value", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// src/functions/block.ts
import "@moonbeam-network/api-augment";
import Bottleneck from "bottleneck";

// src/functions/logger.ts
import pino from "pino";
import pinoPretty from "pino-pretty";
var logLevel = process.env.LOG_LEVEL || "info";
var prettyStream = pinoPretty({
  colorize: true,
  translateTime: "HH:MM:ss.l",
  ignore: "pid,hostname",
  sync: true,
  // Important for worker threads
});
var pinoOptions = {
  level: logLevel,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
};
var loggers = /* @__PURE__ */ new Map();
function createLogger(options) {
  const { name, level = logLevel, enabled = true } = options;
  const existingLogger = loggers.get(name);
  if (existingLogger) {
    return existingLogger;
  }
  const loggerConfig = {
    name,
    level,
    enabled,
    formatters: pinoOptions.formatters,
  };
  const logger2 = pino(loggerConfig, prettyStream);
  loggers.set(name, logger2);
  return logger2;
}
function getLogger(name) {
  return loggers.get(name);
}
function clearLoggers() {
  loggers.clear();
}
function setLoggerEnabled(pattern, enabled) {
  const regex = new RegExp(pattern.replace(/\*/g, ".*"));
  loggers.forEach((logger2, name) => {
    if (regex.test(name)) {
      logger2.level = enabled ? logLevel : "silent";
    }
  });
}
function setupLogger(name) {
  const logger2 = createLogger({
    name: `test:${name}`,
    enabled: process.argv.includes("--printlogs"),
  });
  return logger2;
}

// src/functions/block.ts
var logger = createLogger({ name: "test:blocks" });
var debug = logger.debug.bind(logger);
async function createAndFinalizeBlock(api, parentHash, finalize = false) {
  const startTime = Date.now();
  const block = parentHash
    ? await api.rpc("engine_createBlock", true, finalize, parentHash)
    : await api.rpc("engine_createBlock", true, finalize);
  return {
    duration: Date.now() - startTime,
    hash: block.hash,
    // toString doesn't work for block hashes
    proofSize: block.proof_size,
    // TODO: casting can be removed once api-augment is updated
  };
}
function calculateFeePortions(amount) {
  const burnt = (amount * 80n) / 100n;
  return { burnt, treasury: amount - burnt };
}
var getBlockExtrinsic = async (api, blockHash, section, method) => {
  const apiAt = await api.at(blockHash);
  const [{ block }, records] = await Promise.all([
    api.rpc.chain.getBlock(blockHash),
    apiAt.query.system.events(),
  ]);
  const extIndex = block.extrinsics.findIndex(
    (ext) => ext.method.section === section && ext.method.method === method
  );
  const extrinsic = extIndex > -1 ? block.extrinsics[extIndex] : null;
  const events = records
    .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extIndex))
    .map(({ event }) => event);
  const resultEvent = events.find(
    (event) =>
      event.section === "system" &&
      (event.method === "ExtrinsicSuccess" || event.method === "ExtrinsicFailed")
  );
  return { block, extrinsic, events, resultEvent };
};
var getBlockTime = (signedBlock) =>
  signedBlock.block.extrinsics
    .find((item) => item.method.section === "timestamp")
    .method.args[0].toNumber();
var checkBlockFinalized = async (api, number) => {
  return {
    number,
    //@ts-expect-error - remove once pJs exposes this
    finalized: await api._rpcCore.provider.send("moon_isBlockFinalized", [
      await api.rpc.chain.getBlockHash(number),
    ]),
  };
};
var fetchBlockTime = async (api, blockNum) => {
  const hash = await api.rpc.chain.getBlockHash(blockNum);
  const block = await api.rpc.chain.getBlock(hash);
  return getBlockTime(block);
};
var fetchHistoricBlockNum = async (api, blockNumber, targetTime) => {
  if (blockNumber <= 1) {
    return 1;
  }
  const time = await fetchBlockTime(api, blockNumber);
  if (time <= targetTime) {
    return blockNumber;
  }
  return fetchHistoricBlockNum(api, blockNumber - Math.ceil((time - targetTime) / 3e4), targetTime);
};
var getBlockArray = async (api, timePeriod, bottleneck) => {
  let limiter = bottleneck;
  if (!limiter) {
    limiter = new Bottleneck({ maxConcurrent: 10, minTime: 100 });
  }
  const finalizedHead = await limiter.schedule(() => api.rpc.chain.getFinalizedHead());
  const signedBlock = await limiter.schedule(() => api.rpc.chain.getBlock(finalizedHead));
  const lastBlockNumber = signedBlock.block.header.number.toNumber();
  const lastBlockTime = getBlockTime(signedBlock);
  const firstBlockTime = lastBlockTime - timePeriod;
  debug(`Searching for the block at: ${new Date(firstBlockTime)}`);
  const firstBlockNumber = await limiter.wrap(fetchHistoricBlockNum)(
    api,
    lastBlockNumber,
    firstBlockTime
  );
  const length = lastBlockNumber - firstBlockNumber;
  return Array.from({ length }, (_, i) => firstBlockNumber + i);
};
function extractWeight(weightV1OrV2) {
  if ("isSome" in weightV1OrV2) {
    const weight = weightV1OrV2.unwrap();
    if ("refTime" in weight) {
      return weight.refTime.unwrap();
    }
    return weight;
  }
  if ("refTime" in weightV1OrV2) {
    return weightV1OrV2.refTime.unwrap();
  }
  return weightV1OrV2;
}
function extractPreimageDeposit(request) {
  const deposit = "deposit" in request ? request.deposit : request;
  if ("isSome" in deposit && deposit.isSome) {
    return {
      accountId: deposit.unwrap()[0].toHex(),
      amount: deposit.unwrap()[1],
    };
  }
  if ("isNone" in deposit && deposit.isNone) {
    return void 0;
  }
  return {
    accountId: deposit[0].toHex(),
    amount: deposit[1],
  };
}
function mapExtrinsics(extrinsics, records, fees) {
  return extrinsics.map((extrinsic, index) => {
    let dispatchError;
    let dispatchInfo;
    const events = records
      .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
      .map(({ event }) => {
        if (event.section === "system") {
          if (event.method === "ExtrinsicSuccess") {
            dispatchInfo = event.data[0];
          } else if (event.method === "ExtrinsicFailed") {
            dispatchError = event.data[0];
            dispatchInfo = event.data[1];
          }
        }
        return event;
      });
    return {
      dispatchError,
      dispatchInfo,
      events,
      extrinsic,
      fee: fees ? fees[index] : void 0,
    };
  });
}
async function checkTimeSliceForUpgrades(api, blockNumbers, currentVersion) {
  const apiAt = await api.at(await api.rpc.chain.getBlockHash(blockNumbers[0]));
  const onChainRt = (await apiAt.query.system.lastRuntimeUpgrade()).unwrap().specVersion;
  return { result: !onChainRt.eq(currentVersion), specVersion: onChainRt };
}

// src/functions/common.ts
import "@moonbeam-network/api-augment";
import { BN } from "@polkadot/util";
function sortObjectByKeys(obj) {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  return sortedObj;
}
var Perthing = class {
  unit;
  perthing;
  constructor(unit, num, denom) {
    let numerator = num;
    let denominator = denom;
    if (!(numerator instanceof BN)) {
      numerator = new BN(numerator.toString());
    }
    if (denominator && !(denominator instanceof BN)) {
      denominator = new BN(denominator.toString());
    }
    this.unit = unit;
    if (denominator) {
      this.perthing = numerator.mul(unit).div(denominator);
    } else {
      this.perthing = numerator;
    }
  }
  value() {
    return this.perthing;
  }
  of(value) {
    return this.divNearest(this.perthing.mul(value), this.unit);
  }
  ofCeil(value) {
    return this.divCeil(this.perthing.mul(value), this.unit);
  }
  toString() {
    return `${this.perthing.toString()}`;
  }
  divCeil(a, num) {
    const dm = a.divmod(num);
    if (dm.mod.isZero()) return dm.div;
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }
  divNearest(a, num) {
    const dm = a.divmod(num);
    if (dm.mod.isZero()) return dm.div;
    const mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;
    const half = num.ushrn(1);
    const r2 = num.andln(1);
    const cmp = mod.cmp(half);
    if (cmp <= 0 || (r2 === new BN(1) && cmp === 0)) return dm.div;
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }
};
var Perbill = class extends Perthing {
  constructor(numerator, denominator) {
    super(new BN(1e9), numerator, denominator);
  }
};
var Percent = class extends Perthing {
  constructor(numerator, denominator) {
    super(new BN(100), numerator, denominator);
  }
};
function getObjectMethods(obj) {
  const properties = /* @__PURE__ */ new Set();
  let currentObj = obj;
  while (currentObj) {
    for (const item of Object.getOwnPropertyNames(currentObj)) {
      properties.add(item);
    }
    currentObj = Object.getPrototypeOf(currentObj);
  }
  return Array.from(properties).filter((item) => typeof obj[item] === "function");
}
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

// src/functions/contextHelpers.ts
import "@moonbeam-network/api-augment";
function filterAndApply(events, section, methods, onFound) {
  return events
    .filter(({ event }) => section === event.section && methods.includes(event.method))
    .map((record) => onFound(record));
}
function getDispatchError({
  event: {
    data: [dispatchError],
  },
}) {
  return dispatchError;
}
function getDispatchInfo({ event: { data, method } }) {
  return method === "ExtrinsicSuccess" ? data[0] : data[1];
}
function extractError(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicFailed"], getDispatchError)[0];
}
function isExtrinsicSuccessful(events = []) {
  return filterAndApply(events, "system", ["ExtrinsicSuccess"], () => true).length > 0;
}
function extractInfo(events = []) {
  return filterAndApply(
    events,
    "system",
    ["ExtrinsicFailed", "ExtrinsicSuccess"],
    getDispatchInfo
  )[0];
}
function extractFee(events = []) {
  return filterAndApply(events, "balances", ["Withdraw"], ({ event }) => event.data)[0];
}

// src/functions/contracts.ts
import fs from "fs";
import path from "path";
function getAllCompiledContracts(contractsDir = "./", recurse = false) {
  const contractsPath = path.isAbsolute(contractsDir)
    ? contractsDir
    : path.join(process.cwd(), contractsDir);
  const contracts = fs.readdirSync(contractsPath, { withFileTypes: true });
  let contractNames = [];
  for (const dirent of contracts) {
    const fullDirentPath = path.join(contractsPath, dirent.name);
    if (dirent.isDirectory() && recurse) {
      contractNames = contractNames.concat(getAllCompiledContracts(fullDirentPath, recurse));
    } else if (dirent.isFile() && path.extname(dirent.name) === ".json") {
      contractNames.push(path.basename(dirent.name, ".json"));
    }
  }
  return contractNames;
}
function getCompiled(contractPath) {
  const filePath = path.join(process.cwd(), `${contractPath}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Contract name (${contractPath}) doesn't exist in test suite`);
  }
  try {
    const json = fs.readFileSync(filePath, "utf8");
    return JSON.parse(json);
  } catch (e) {
    throw new Error(
      `Contract name ${contractPath} is not compiled. Please check compiled json exists`
    );
  }
}

// src/functions/ethers.ts
import { Wallet } from "ethers";
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

// src/functions/extrinsics.ts
var signAndSend = async (tx, account = alith, nonce = -1) =>
  new Promise((resolve) =>
    tx.signAndSend(account, { nonce }, ({ status }) => {
      if (status.isInBlock) {
        process.stdout.write(
          "Extrinsic submitted and included in block, waiting for finalization..."
        );
      }
      if (status.isFinalized) {
        process.stdout.write("\u2705\n");
        resolve(true);
      }
    })
  );

// src/functions/jumping.ts
import "@moonbeam-network/api-augment";
import WebSocket from "ws";
async function jumpBlocksDev(polkadotJsApi, blocks) {
  let blockCount = blocks;
  while (blockCount > 0) {
    await polkadotJsApi.rpc.engine.createBlock(true, true);
    blockCount--;
  }
}
async function jumpRoundsDev(polkadotJsApi, count) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundDev(polkadotJsApi, round);
}
async function jumpToRoundDev(polkadotJsApi, round) {
  let lastBlockHash = "";
  for (;;) {
    const currentRound = (await polkadotJsApi.query.parachainStaking.round()).current.toNumber();
    if (currentRound === round) {
      return lastBlockHash;
    }
    if (currentRound > round) {
      return null;
    }
    lastBlockHash = (await polkadotJsApi.rpc.engine.createBlock(true, true)).blockHash.toString();
  }
}
async function calculateBlocks(polkadotJsApi, targetRound) {
  const roundInfo = await polkadotJsApi.query.parachainStaking.round();
  if (roundInfo.current.toNumber() >= targetRound) {
    return 0;
  }
  const roundsToJump = targetRound - roundInfo.current.toNumber();
  const heightToJump = roundInfo.first.toNumber() + roundsToJump * roundInfo.length.toNumber();
  const currentBlock = (await polkadotJsApi.rpc.chain.getHeader()).number.toNumber();
  return heightToJump - currentBlock;
}
async function jumpRoundsChopsticks(polkadotJsApi, port, count) {
  const round = (await polkadotJsApi.query.parachainStaking.round()).current
    .addn(count.valueOf())
    .toNumber();
  return jumpToRoundChopsticks(polkadotJsApi, port, round);
}
async function jumpToRoundChopsticks(polkadotJsApi, port, round) {
  const blockToJump = await calculateBlocks(polkadotJsApi, round);
  return jumpBlocksChopsticks(port, blockToJump);
}
async function jumpBlocksChopsticks(port, blockCount) {
  return await sendNewBlockCmd(port, blockCount);
}
var sendNewBlockCmd = async (port, count = 1) => {
  const websocketUrl = `ws://127.0.0.1:${port}`;
  const socket = new WebSocket(websocketUrl);
  const result = await new Promise((resolve) => {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "dev_newBlock",
          params: [{ count }],
        })
      );
    });
    socket.on("message", (chunk) => {
      const data = JSON.parse(chunk.toString());
      resolve(data.result);
      socket.close();
    });
  });
  return result;
};

// src/functions/logging.ts
import "@moonbeam-network/api-augment";
var setupLogger2 = setupLogger;
function log(...msg) {
  if (process.argv?.[2] && process.argv[2] === "--printlogs") {
    console.log(...msg);
  }
}
var printTokens = (api, tokens, decimals = 2, pad = 9) => {
  if (!api.registry.chainDecimals[0]) {
    throw new Error("Chain decimals not found for system token");
  }
  return `${(Math.ceil(Number(tokens / 10n ** BigInt(api.registry.chainDecimals[0] - decimals))) / 10 ** decimals).toString().padStart(pad)} ${api.registry.chainTokens[0]}`;
};
var printEvents = async (api, hash) => {
  const blockHash = hash || (await api.rpc.chain.getBlockHash()).toString();
  const apiAt = await api.at(blockHash);
  const { block } = await api.rpc.chain.getBlock(blockHash);
  const allRecords = await apiAt.query.system.events();
  const txsWithEvents = mapExtrinsics(block.extrinsics, allRecords);
  console.log(`===== Block #${block.header.number.toString()}: ${blockHash}`);
  console.log(block.header.toHuman());
  console.log(
    txsWithEvents
      .map(
        (
          { extrinsic, events },
          i
        ) => `  [${i}]: ${extrinsic.method.section.toString()}. ${extrinsic.method.method.toString()}
  - 0x${Buffer.from(extrinsic.data).toString("hex")}
${events
  .map(
    (event) => `    * ${event.section.toString()}.${event.method.toString()}:
${event.data.map((datum) => `      - ${datum.toHex()}`).join("\n")}`
  )
  .join("\n")}`
      )
      .join("\n")
  );
};

// src/functions/providers.ts
import "@moonbeam-network/api-augment";
async function customWeb3Request(web3, method, params) {
  return new Promise((resolve, reject) => {
    web3.eth.currentProvider.send(
      {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      },
      (error, result) => {
        if (error) {
          reject(
            `Failed to send custom request (${method} (${params
              .map((p) => {
                const str = p.toString();
                return str.length > 128 ? `${str.slice(0, 96)}...${str.slice(-28)}` : str;
              })
              .join(",")})): ${error.message || error.toString()}`
          );
        }
        resolve(result);
      }
    );
  });
}
async function web3EthCall(web3, options) {
  return await customWeb3Request(web3, "eth_call", [
    {
      from: options.from === void 0 ? options.from : alith.address,
      value: options.value,
      gas: options.gas === void 0 ? options.gas : 256e3,
      gasPrice: options.gas === void 0 ? options.gas : `0x${MIN_GAS_PRICE}`,
      to: options.to,
      data: options.data,
    },
  ]);
}

// src/functions/viem.ts
import { createWalletClient, hexToNumber, http } from "viem";
import { setTimeout as timer } from "timers/promises";
import { privateKeyToAccount } from "viem/accounts";
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
  ALITH_ADDRESS,
  ALITH_CONTRACT_ADDRESSES,
  ALITH_GENESIS_FREE_BALANCE,
  ALITH_GENESIS_LOCK_BALANCE,
  ALITH_GENESIS_RESERVE_BALANCE,
  ALITH_GENESIS_TRANSFERABLE_BALANCE,
  ALITH_PRIVATE_KEY,
  ALITH_SESSION_ADDRESS,
  BALTATHAR_ADDRESS,
  BALTATHAR_PRIVATE_KEY,
  BALTATHAR_SESSION_ADDRESS,
  BASE_PATH,
  BINARY_PATH,
  BLOCK_GAS_LIMIT,
  BLOCK_WEIGHT_LIMIT,
  CHARLETH_ADDRESS,
  CHARLETH_PRIVATE_KEY,
  CHARLETH_SESSION_ADDRESS,
  CONTRACT_PROXY_TYPE_ANY,
  CONTRACT_PROXY_TYPE_AUTHOR_MAPPING,
  CONTRACT_PROXY_TYPE_BALANCES,
  CONTRACT_PROXY_TYPE_CANCEL_PROXY,
  CONTRACT_PROXY_TYPE_GOVERNANCE,
  CONTRACT_PROXY_TYPE_IDENTITY_JUDGEMENT,
  CONTRACT_PROXY_TYPE_NON_TRANSFER,
  CONTRACT_PROXY_TYPE_STAKING,
  CONTRACT_RANDOMNESS_STATUS_DOES_NOT_EXISTS,
  CONTRACT_RANDOMNESS_STATUS_EXPIRED,
  CONTRACT_RANDOMNESS_STATUS_PENDING,
  CONTRACT_RANDOMNESS_STATUS_READY,
  CUSTOM_SPEC_PATH,
  DAYS,
  DEBUG_MODE,
  DEFAULT_GENESIS_BALANCE,
  DEFAULT_GENESIS_MAPPING,
  DEFAULT_GENESIS_STAKING,
  DEFAULT_TRANSACTION,
  DISPLAY_LOG,
  DOROTHY_ADDRESS,
  DOROTHY_PRIVATE_KEY,
  DUMMY_REVERT_BYTECODE,
  ETHAN_ADDRESS,
  ETHAN_PRIVATE_KEY,
  ETHAPI_CMD,
  EXTRINSIC_BASE_WEIGHT,
  EXTRINSIC_GAS_LIMIT,
  EthTester,
  FAITH_ADDRESS,
  FAITH_PRIVATE_KEY,
  FIVE_MINS,
  FOUR_HOURS,
  GAS_LIMIT_POV_RATIO,
  GAS_PER_POV_BYTES,
  GAS_PER_SECOND,
  GAS_PER_WEIGHT,
  GERALD_ADDRESS,
  GERALD_CONTRACT_ADDRESSES,
  GERALD_PRIVATE_KEY,
  GLMR,
  GOLIATH_ADDRESS,
  GOLIATH_PRIVATE_KEY,
  HOURS,
  MAX_BLOCK_DEV_POV,
  MAX_BLOCK_WEIGHT,
  MAX_ETH_POV_PER_TX,
  MICROGLMR,
  MILLIGLMR,
  MINUTES,
  MIN_GAS_PRICE,
  MIN_GLMR_DELEGATOR,
  MIN_GLMR_STAKING,
  MOONBEAM_LOG,
  ONE_HOURS,
  OVERRIDE_RUNTIME_PATH,
  PRECOMPILES,
  PRECOMPILE_AUTHOR_MAPPING_ADDRESS,
  PRECOMPILE_BATCH_ADDRESS,
  PRECOMPILE_CALL_PERMIT_ADDRESS,
  PRECOMPILE_CONVICTION_VOTING_ADDRESS,
  PRECOMPILE_COUNCIL_ADDRESS,
  PRECOMPILE_CROWDLOAN_REWARDS_ADDRESS,
  PRECOMPILE_DEMOCRACY_ADDRESS,
  PRECOMPILE_DISPATCH_ADDRESS,
  PRECOMPILE_GMP_ADDRESS,
  PRECOMPILE_NATIVE_ERC20_ADDRESS,
  PRECOMPILE_OPEN_TECH_COMMITTEE_ADDRESS,
  PRECOMPILE_PARACHAIN_STAKING_ADDRESS,
  PRECOMPILE_PREIMAGE_ADDRESS,
  PRECOMPILE_PROXY_ADDRESS,
  PRECOMPILE_RANDOMNESS_ADDRESS,
  PRECOMPILE_REFERENDA_ADDRESS,
  PRECOMPILE_RELAY_ENCODER_ADDRESS,
  PRECOMPILE_TECH_COMMITTEE_ADDRESS,
  PRECOMPILE_TREASURY_COUNCIL_ADDRESS,
  PRECOMPILE_XCM_TRANSACTOR_ADDRESS_V1,
  PRECOMPILE_XCM_TRANSACTOR_ADDRESS_V2,
  PRECOMPILE_XCM_UTILS_ADDRESS,
  PRECOMPILE_XTOKENS_ADDRESS,
  PROPOSAL_AMOUNT,
  Perbill,
  Percent,
  RELAY_BINARY_PATH,
  RELAY_CHAIN_NODE_NAMES,
  RELAY_LOG,
  RUNTIME_CONSTANTS,
  SPAWNING_TIME,
  SPECS_PATH,
  TARGET_FILL_AMOUNT,
  TARGET_FILL_PERMILL,
  TEN_MINS,
  THIRTY_MINS,
  THREE_HOURS,
  TREASURY_ACCOUNT,
  TWO_HOURS,
  TWO_MINS,
  VOTE_AMOUNT,
  WASM_RUNTIME_OVERRIDES,
  WEIGHT_FEE,
  WEIGHT_PER_GAS,
  WEIGHT_PER_SECOND,
  ZERO_ADDRESS,
  alith,
  baltathar,
  calculateFeePortions,
  charleth,
  checkBalance,
  checkBlockFinalized,
  checkTimeSliceForUpgrades,
  clearLoggers,
  createAndFinalizeBlock,
  createEthersTransaction,
  createLogger,
  createRawTransfer,
  createViemTransaction,
  customWeb3Request,
  deployViemContract,
  deriveViemChain,
  directRpcRequest,
  dorothy,
  ethan,
  extractError,
  extractFee,
  extractInfo,
  extractPreimageDeposit,
  extractWeight,
  faith,
  fetchHistoricBlockNum,
  filterAndApply,
  generateKeyringPair,
  gerald,
  getAllCompiledContracts,
  getBlockArray,
  getBlockExtrinsic,
  getBlockTime,
  getCompiled,
  getDevChain,
  getDispatchError,
  getLogger,
  getObjectMethods,
  goliath,
  isExtrinsicSuccessful,
  jumpBlocksChopsticks,
  jumpBlocksDev,
  jumpRoundsChopsticks,
  jumpRoundsDev,
  jumpToRoundChopsticks,
  jumpToRoundDev,
  log,
  mapExtrinsics,
  printEvents,
  printTokens,
  sendRawTransaction,
  setLoggerEnabled,
  setupLogger2 as setupLogger,
  signAndSend,
  sortObjectByKeys,
  web3EthCall,
  xcAssetAbi,
};
//# sourceMappingURL=index.js.map
