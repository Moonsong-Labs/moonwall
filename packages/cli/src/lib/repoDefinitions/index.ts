import { RepoSpec } from "@moonwall/types";
import mb from "./moonbeam";
import pd from "./polkadot";
import ts from "./tanssi";
import { importJsonConfig } from "../configReader";

function getRepos() {
  const defaultRepos: RepoSpec[] = [mb, pd, ts];
  const globalConfig = importJsonConfig();
  const importedRepos = globalConfig.additionalRepos ? globalConfig.additionalRepos : [];
  return [...defaultRepos, ...importedRepos];
}

export default getRepos;
