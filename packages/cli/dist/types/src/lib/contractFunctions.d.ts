import type {
  ContractCallOptions,
  ContractDeploymentOptions,
  DevModeContext,
  GenericContext,
  MoonwallContract,
  PrecompileCallOptions,
} from "@moonwall/types";
import type { Abi } from "viem";
import { type Log } from "viem";
export declare function fetchCompiledContract<TAbi extends Abi>(
  contractName: string
): MoonwallContract<TAbi>;
export declare function recursiveSearch(dir: string, filename: string): string | null;
export declare function interactWithPrecompileContract(
  context: GenericContext,
  callOptions: PrecompileCallOptions
): Promise<any>;
export declare function interactWithContract(
  context: GenericContext,
  callOptions: ContractCallOptions
): Promise<any>;
export declare function deployCreateCompiledContract<TOptions extends ContractDeploymentOptions>(
  context: DevModeContext,
  contractName: string,
  options?: TOptions
): Promise<{
  contractAddress: `0x${string}`;
  logs: Log<bigint, number>[];
  hash: `0x${string}`;
  status: "success" | "reverted";
  abi: Abi;
  bytecode: `0x${string}`;
  methods: any;
}>;
