import { Wallet } from "ethers";
import { ALITH_ADDRESS } from "../constants/accounts";
const transactionHandlers = {
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
export async function createEthersTransaction(context, params) {
  // const nonce = await context.viem().getTransactionCount({ address: ALITH_ADDRESS });
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
//# sourceMappingURL=ethers.js.map
