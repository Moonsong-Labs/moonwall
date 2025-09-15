import type { GenericContext, EthersTransactionOptions } from "@moonwall/types";
import {
  type AccessListish,
  type BigNumberish,
  type TransactionRequest,
  Wallet,
  type Provider,
} from "ethers";
import type { TransactionType } from "@moonwall/types";
import { ALITH_ADDRESS } from "../constants/accounts.js";

type TransactionHandler = (blob: TransactionBlob, params: TransactionRequest) => void;

interface TransactionBlob {
  gasPrice?: BigNumberish;
  gasLimit?: BigNumberish;
  accessList?: AccessListish; // Replace any[] with a more specific type if you have one
  maxFeePerGas?: BigNumberish;
  maxPriorityFeePerGas?: BigNumberish;
  type?: number;
}

const transactionHandlers: Record<TransactionType, TransactionHandler> = {
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

export async function createEthersTransaction<TOptions extends EthersTransactionOptions>(
  context: GenericContext,
  params: TOptions
) {
  // const nonce = await context.viem().getTransactionCount({ address: ALITH_ADDRESS });
  const nonce =
    "nonce" in params
      ? params.nonce
      : await context.viem().getTransactionCount({ address: ALITH_ADDRESS });
  const blob: object = { nonce, ...params };

  const handler = transactionHandlers[params.txnType || "legacy"];
  if (!handler) {
    throw new Error("Unknown transaction type, update createRawEthersTxn fn");
  }

  handler(blob, params);

  const ethersInstance = context.ethers();

  // WORKAROUND: Ethers v6 dual-package hazard
  // TypeScript sees two different 'Provider' types (CJS vs ESM) from ethers,
  // even though they are runtime compatible. This is a known issue with ethers v6.
  // Attempts to avoid this cast (using connect(), standalone wallets, etc.) all fail
  // because populateTransaction requires a provider. The only non-casting solutions
  // would require risky TypeScript config changes or moonwall framework modifications.
  // Since we verified only one ethers installation exists, this cast is safe at runtime.
  const signer = params.privateKey
    ? new Wallet(params.privateKey, ethersInstance.provider as unknown as Provider)
    : ethersInstance;

  const txn = await signer.populateTransaction(blob);
  return (await signer.signTransaction(txn)) as `0x${string}`;
}
