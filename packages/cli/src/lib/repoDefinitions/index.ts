import type { RepoSpec } from "@moonwall/types";
import mb from "./moonbeam";
import pd from "./polkadot";
import ts from "./tanssi";
import { importAsyncConfig, importJsonConfig } from "../configReader";

export function allRepos() {
  const defaultRepos: RepoSpec[] = [mb, pd, ts];
  const globalConfig = importJsonConfig();
  const importedRepos = globalConfig.additionalRepos ? globalConfig.additionalRepos : [];
  return [...defaultRepos, ...importedRepos];
}

export async function allReposAsync() {
  const defaultRepos: RepoSpec[] = [mb, pd, ts];
  const globalConfig = await importAsyncConfig();
  const importedRepos = globalConfig.additionalRepos || [];
  return [...defaultRepos, ...importedRepos];
}

export function standardRepos() {
  const defaultRepos: RepoSpec[] = [mb, pd, ts];
  return [...defaultRepos];
}

export default allRepos;
