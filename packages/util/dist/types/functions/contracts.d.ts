import type { CompiledContract } from "@moonwall/types";
import type { Abi } from "viem";
export declare function getAllCompiledContracts(contractsDir?: string, recurse?: boolean): string[];
export declare function getCompiled<TAbi extends Abi>(contractPath: string): CompiledContract<TAbi>;
