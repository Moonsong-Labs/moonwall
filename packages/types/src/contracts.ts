import { Abi } from "viem";


export type ForgeContract<TAbi extends Abi> = {
  abi: TAbi
  bytecode: `0x${string}`;
  methods: Record<string, string>[]
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