import { Abi, DeployContractParameters } from "viem";
import { DeepPartial } from "./helpers.js";
import { EthTransactionType } from "./config.js";

export type ForgeContract<TAbi extends Abi> = {
  abi: TAbi;
  bytecode: `0x${string}`;
  methods: Record<string, string>[];
  deployedBytecode: `0x${string}`;
};

export type CompiledContract<TAbi extends Abi> = {
  byteCode: `0x${string}`;
  contract: ContractObject<TAbi>;
  sourceCode: string;
};

export type ContractObject<TAbi extends Abi> = {
  abi: TAbi;
  devdoc: any;
  evm: any;
  ewasm: any;
  metadata: any;
  storageLayout: any;
  userdoc: any;
};

export type ContractDeploymentOptions = DeepPartial<
  Omit<DeployContractParameters, "abi" | "bytecode" | "privateKey">
> & {
  privateKey?: `0x${string}`;
  args?: any[];
  txnType?: EthTransactionType;
};
