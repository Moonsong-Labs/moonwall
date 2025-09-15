import type { ApiPromise } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/types";
import type { EventRecord } from "@polkadot/types/interfaces";

// Generic type for any submittable extrinsic
export type AnyExtrinsic = SubmittableExtrinsic<"promise", any>;

// Helper to access tx pallets with casting
export function getTx(
  api: ApiPromise,
  pallet: string,
  method: string
): (...args: any[]) => AnyExtrinsic {
  return (...args: any[]) => {
    const palletObj = (api.tx as any)[pallet];
    if (!palletObj) throw new Error(`Pallet ${pallet} not found`);
    const methodFn = palletObj[method];
    if (!methodFn) throw new Error(`Method ${pallet}.${method} not found`);
    return methodFn(...args);
  };
}

// Helper to access query storage
export function getQuery(
  api: ApiPromise,
  pallet: string,
  storage: string
): (...args: any[]) => Promise<any> {
  return (...args: any[]) => {
    const palletObj = (api.query as any)[pallet];
    if (!palletObj) throw new Error(`Query pallet ${pallet} not found`);
    const storageFn = palletObj[storage];
    if (!storageFn) throw new Error(`Storage ${pallet}.${storage} not found`);
    return storageFn(...args);
  };
}

// Helper to access RPC methods
export function getRpc(
  api: ApiPromise,
  section: string,
  method: string
): (...args: any[]) => Promise<any> {
  return (...args: any[]) => {
    const sectionObj = (api.rpc as any)[section];
    if (!sectionObj) throw new Error(`RPC section ${section} not found`);
    const methodFn = sectionObj[method];
    if (!methodFn) throw new Error(`RPC method ${section}.${method} not found`);
    return methodFn(...args);
  };
}

// Helper to check events
export function isEvent(record: EventRecord, pallet: string, eventName: string): boolean {
  return record.event.section === pallet && record.event.method === eventName;
}

// Helper to access constants
export function getConst(api: ApiPromise, pallet: string, constant: string): any {
  const palletObj = (api.consts as any)[pallet];
  if (!palletObj) throw new Error(`Const pallet ${pallet} not found`);
  return palletObj[constant];
}

// Moonbeam-specific helpers
export const moonbeamTx = {
  // EVM operations
  evmCall: (api: ApiPromise) => getTx(api, "evm", "call"),
  evmCreate: (api: ApiPromise) => getTx(api, "evm", "create"),

  // Ethereum operations
  ethereumTransact: (api: ApiPromise) => getTx(api, "ethereum", "transact"),

  // Staking operations
  parachainStakingDelegate: (api: ApiPromise) => getTx(api, "parachainStaking", "delegate"),
  parachainStakingJoinCandidates: (api: ApiPromise) =>
    getTx(api, "parachainStaking", "joinCandidates"),
  parachainStakingCancelDelegationRequest: (api: ApiPromise) =>
    getTx(api, "parachainStaking", "cancelDelegationRequest"),
  parachainStakingDelegatorBondMore: (api: ApiPromise) =>
    getTx(api, "parachainStaking", "delegatorBondMore"),

  // Asset operations
  assetManagerRegisterForeignAsset: (api: ApiPromise) =>
    getTx(api, "assetManager", "registerForeignAsset"),
  assetManagerSetAssetUnitsPerSecond: (api: ApiPromise) =>
    getTx(api, "assetManager", "setAssetUnitsPerSecond"),

  // XCM operations
  xcmTransactorTransactThroughDerivative: (api: ApiPromise) =>
    getTx(api, "xcmTransactor", "transactThroughDerivative"),
  xcmTransactorTransactThroughSovereign: (api: ApiPromise) =>
    getTx(api, "xcmTransactor", "transactThroughSovereign"),

  // Balances operations (standard but commonly used)
  balancesTransfer: (api: ApiPromise) => getTx(api, "balances", "transfer"),
  balancesTransferKeepAlive: (api: ApiPromise) => getTx(api, "balances", "transferKeepAlive"),

  // System operations
  systemRemark: (api: ApiPromise) => getTx(api, "system", "remark"),
  systemRemarkWithEvent: (api: ApiPromise) => getTx(api, "system", "remarkWithEvent"),

  // Sudo operations
  sudoSudo: (api: ApiPromise) => getTx(api, "sudo", "sudo"),
  sudoSudoAs: (api: ApiPromise) => getTx(api, "sudo", "sudoAs"),
};

export const moonbeamQuery = {
  // EVM queries
  evmAccountCodes: (api: ApiPromise) => getQuery(api, "evm", "accountCodes"),
  evmAccountStorages: (api: ApiPromise) => getQuery(api, "evm", "accountStorages"),

  // Staking queries
  parachainStakingCandidateInfo: (api: ApiPromise) =>
    getQuery(api, "parachainStaking", "candidateInfo"),
  parachainStakingDelegatorState: (api: ApiPromise) =>
    getQuery(api, "parachainStaking", "delegatorState"),
  parachainStakingCandidatePool: (api: ApiPromise) =>
    getQuery(api, "parachainStaking", "candidatePool"),
  parachainStakingSelectedCandidates: (api: ApiPromise) =>
    getQuery(api, "parachainStaking", "selectedCandidates"),
  parachainStakingRound: (api: ApiPromise) => getQuery(api, "parachainStaking", "round"),

  // Asset queries
  assetManagerAssetIdType: (api: ApiPromise) => getQuery(api, "assetManager", "assetIdType"),
  assetManagerAssetTypeId: (api: ApiPromise) => getQuery(api, "assetManager", "assetTypeId"),
  assetManagerAssetTypeUnitsPerSecond: (api: ApiPromise) =>
    getQuery(api, "assetManager", "assetTypeUnitsPerSecond"),

  // System queries
  systemAccount: (api: ApiPromise) => getQuery(api, "system", "account"),
  systemBlockHash: (api: ApiPromise) => getQuery(api, "system", "blockHash"),
  systemEvents: (api: ApiPromise) => getQuery(api, "system", "events"),

  // Timestamp
  timestampNow: (api: ApiPromise) => getQuery(api, "timestamp", "now"),

  // Balances
  balancesTotalIssuance: (api: ApiPromise) => getQuery(api, "balances", "totalIssuance"),
};

export const moonbeamRpc = {
  // Ethereum RPC
  ethCall: (api: ApiPromise) => getRpc(api, "eth", "call"),
  ethGetBalance: (api: ApiPromise) => getRpc(api, "eth", "getBalance"),
  ethGetCode: (api: ApiPromise) => getRpc(api, "eth", "getCode"),
  ethGetTransactionCount: (api: ApiPromise) => getRpc(api, "eth", "getTransactionCount"),
  ethGetBlockByNumber: (api: ApiPromise) => getRpc(api, "eth", "getBlockByNumber"),
  ethGetTransactionReceipt: (api: ApiPromise) => getRpc(api, "eth", "getTransactionReceipt"),
  ethSendRawTransaction: (api: ApiPromise) => getRpc(api, "eth", "sendRawTransaction"),

  // Debug RPC
  debugTraceTransaction: (api: ApiPromise) => getRpc(api, "debug", "traceTransaction"),
  debugTraceBlockByNumber: (api: ApiPromise) => getRpc(api, "debug", "traceBlockByNumber"),

  // Moon RPC
  moonIsBlockFinalized: (api: ApiPromise) => getRpc(api, "moon", "isBlockFinalized"),
  moonIsTxFinalized: (api: ApiPromise) => getRpc(api, "moon", "isTxFinalized"),

  // Chain RPC
  chainGetBlock: (api: ApiPromise) => getRpc(api, "chain", "getBlock"),
  chainGetBlockHash: (api: ApiPromise) => getRpc(api, "chain", "getBlockHash"),
  chainGetFinalizedHead: (api: ApiPromise) => getRpc(api, "chain", "getFinalizedHead"),

  // State RPC
  stateGetStorage: (api: ApiPromise) => getRpc(api, "state", "getStorage"),
  stateGetRuntimeVersion: (api: ApiPromise) => getRpc(api, "state", "getRuntimeVersion"),
};

// Event checkers for Moonbeam
export const moonbeamEvents = {
  // EVM events
  isEvmLog: (record: EventRecord) => isEvent(record, "evm", "Log"),
  isEvmCreated: (record: EventRecord) => isEvent(record, "evm", "Created"),
  isEvmCreatedFailed: (record: EventRecord) => isEvent(record, "evm", "CreatedFailed"),
  isEvmExecuted: (record: EventRecord) => isEvent(record, "evm", "Executed"),
  isEvmExecutedFailed: (record: EventRecord) => isEvent(record, "evm", "ExecutedFailed"),

  // Ethereum events
  isEthereumExecuted: (record: EventRecord) => isEvent(record, "ethereum", "Executed"),

  // Staking events
  isParachainStakingRewarded: (record: EventRecord) =>
    isEvent(record, "parachainStaking", "Rewarded"),
  isParachainStakingNewRound: (record: EventRecord) =>
    isEvent(record, "parachainStaking", "NewRound"),
  isParachainStakingDelegation: (record: EventRecord) =>
    isEvent(record, "parachainStaking", "Delegation"),
  isParachainStakingDelegationRevoked: (record: EventRecord) =>
    isEvent(record, "parachainStaking", "DelegationRevoked"),

  // System events
  isSystemExtrinsicSuccess: (record: EventRecord) => isEvent(record, "system", "ExtrinsicSuccess"),
  isSystemExtrinsicFailed: (record: EventRecord) => isEvent(record, "system", "ExtrinsicFailed"),

  // Balances events
  isBalancesTransfer: (record: EventRecord) => isEvent(record, "balances", "Transfer"),
  isBalancesDeposit: (record: EventRecord) => isEvent(record, "balances", "Deposit"),
  isBalancesWithdraw: (record: EventRecord) => isEvent(record, "balances", "Withdraw"),
};

// Constants helpers for Moonbeam
export const moonbeamConsts = {
  // System constants
  systemBlockHashCount: (api: ApiPromise) => getConst(api, "system", "blockHashCount"),
  systemBlockLength: (api: ApiPromise) => getConst(api, "system", "blockLength"),
  systemBlockWeights: (api: ApiPromise) => getConst(api, "system", "blockWeights"),

  // Balances constants
  balancesExistentialDeposit: (api: ApiPromise) => getConst(api, "balances", "existentialDeposit"),

  // Timestamp
  timestampMinimumPeriod: (api: ApiPromise) => getConst(api, "timestamp", "minimumPeriod"),

  // ParachainStaking constants
  parachainStakingMinDelegation: (api: ApiPromise) =>
    getConst(api, "parachainStaking", "minDelegation"),
  parachainStakingMinCandidateStk: (api: ApiPromise) =>
    getConst(api, "parachainStaking", "minCandidateStk"),
  parachainStakingMaxDelegationsPerDelegator: (api: ApiPromise) =>
    getConst(api, "parachainStaking", "maxDelegationsPerDelegator"),
};

// Utility function to safely access nested properties
export function safeAccess(api: ApiPromise, path: string): any {
  const parts = path.split(".");
  let current: any = api;

  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      throw new Error(`Path ${path} not found in API`);
    }
  }

  return current;
}

// Generic helper for any API access not covered above
export function callApi(api: ApiPromise, path: string, ...args: any[]): any {
  const fn = safeAccess(api, path);
  if (typeof fn === "function") {
    return fn(...args);
  }
  return fn;
}
