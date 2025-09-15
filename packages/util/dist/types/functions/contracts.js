import fs from "node:fs";
import path from "node:path";
export function getAllCompiledContracts(contractsDir = "./", recurse = false) {
  const contractsPath = path.isAbsolute(contractsDir)
    ? contractsDir
    : path.join(process.cwd(), contractsDir);
  const contracts = fs.readdirSync(contractsPath, { withFileTypes: true });
  let contractNames = [];
  for (const dirent of contracts) {
    const fullDirentPath = path.join(contractsPath, dirent.name);
    if (dirent.isDirectory() && recurse) {
      contractNames = contractNames.concat(getAllCompiledContracts(fullDirentPath, recurse));
    } else if (dirent.isFile() && path.extname(dirent.name) === ".json") {
      contractNames.push(path.basename(dirent.name, ".json"));
    }
  }
  return contractNames;
}
export function getCompiled(contractPath) {
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
//# sourceMappingURL=contracts.js.map
