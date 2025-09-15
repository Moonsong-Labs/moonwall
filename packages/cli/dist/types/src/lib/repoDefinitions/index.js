import mb from "./moonbeam";
import pd from "./polkadot";
import ts from "./tanssi";
import { importAsyncConfig, importJsonConfig } from "../configReader";
export function allRepos() {
  const defaultRepos = [mb, pd, ts];
  const globalConfig = importJsonConfig();
  const importedRepos = globalConfig.additionalRepos ? globalConfig.additionalRepos : [];
  return [...defaultRepos, ...importedRepos];
}
export async function allReposAsync() {
  const defaultRepos = [mb, pd, ts];
  const globalConfig = await importAsyncConfig();
  const importedRepos = globalConfig.additionalRepos || [];
  return [...defaultRepos, ...importedRepos];
}
export function standardRepos() {
  const defaultRepos = [mb, pd, ts];
  return [...defaultRepos];
}
export default allRepos;
//# sourceMappingURL=index.js.map
