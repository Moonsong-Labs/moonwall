import type { GenericContext, EthersTransactionOptions } from "@moonwall/types";
export declare function createEthersTransaction<TOptions extends EthersTransactionOptions>(
  context: GenericContext,
  params: TOptions
): Promise<`0x${string}`>;
