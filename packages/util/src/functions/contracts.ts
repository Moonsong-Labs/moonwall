import fs from "fs";
import path from "path";
import type { Abi } from "viem";
import { CompiledContract } from "@moonwall/types";

export function getAllContracts(contractsDir: string = "./"): string[] {
  const contractsPath = path.join(process.cwd(), contractsDir);
  const contracts = fs.readdirSync(contractsPath, { withFileTypes: true });
  // Register all the contract code
  return contracts
    .filter((dirent) => dirent.isFile())
    .map((contract) => path.basename(contract.name, ".json"));
}

export function getCompiled<TAbi extends Abi>(contractPath: string): CompiledContract<TAbi> {
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
