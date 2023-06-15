import { DevModeContext } from "@moonwall/types";
import { TransactionRequest } from "ethers";
import { TransactionType } from "@moonwall/types";
import { ALITH_ADDRESS } from "../constants/accounts.js";

type TransactionHandler = (blob: {}, params: TransactionRequest) => void;

const transactionHandlers: Record<TransactionType, TransactionHandler> = {
  legacy: (blob, params) => {
    blob["gasPrice"] = params.gasPrice || 10_000_000_000;
    blob["gasLimit"] = params.gasLimit || 200000;
    blob["type"] = 0;
  },
  eip2930: (blob, params) => {
    blob["gasPrice"] = params.gasPrice || 10_000_000_000;
    blob["gasLimit"] = params.gasLimit || 200000;
    blob["accessList"] = params.accessList || [];
    blob["type"] = 1;
  },
  eip1559: (blob, params) => {
    blob["accessList"] = params.accessList || [];
    blob["maxFeePerGas"] = params.maxFeePerGas || 10_000_000_000;
    blob["maxPriorityFeePerGas"] = params.maxPriorityFeePerGas || 0;
    blob["gasLimit"] = params.gasLimit || 200000;
    blob["type"] = 2;
  },
};

export async function createEthersTxn<
  TOptions extends TransactionRequest & { txnType?: TransactionType }
>(context: DevModeContext, params: TOptions) {
  const nonce = await context.viem("public").getTransactionCount({ address: ALITH_ADDRESS });
  const blob: {} = { nonce, ...params };

  const handler = transactionHandlers[params.txnType || "legacy"];
  if (!handler) {
    throw new Error("Unknown transaction type, update createRawEthersTxn fn");
  }
  handler(blob, params);

  const txn = await context.ethers().populateTransaction(blob);
  const raw = await context.ethers().signTransaction(txn);
  return { rawSigned: raw as `0x${string}`, request: txn };
}
