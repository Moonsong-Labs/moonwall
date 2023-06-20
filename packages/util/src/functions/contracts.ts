import { CompiledContract } from "@moonwall/types";
import fs from "fs";
import path from "path";
import type { Abi } from "viem";

export function getAllCompiledContracts(
  contractsDir: string = "./",
  recurse: boolean = false
): string[] {
  const contractsPath = path.isAbsolute(contractsDir)
    ? contractsDir
    : path.join(process.cwd(), contractsDir);
  let contracts = fs.readdirSync(contractsPath, { withFileTypes: true });

  let contractNames: string[] = [];

  contracts.forEach((dirent) => {
    const fullDirentPath = path.join(contractsPath, dirent.name);

    if (dirent.isDirectory() && recurse) {
      contractNames = contractNames.concat(getAllCompiledContracts(fullDirentPath, recurse));
    } else if (dirent.isFile() && path.extname(dirent.name) === ".json") {
      contractNames.push(path.basename(dirent.name, ".json"));
    }
  });

  return contractNames;
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
