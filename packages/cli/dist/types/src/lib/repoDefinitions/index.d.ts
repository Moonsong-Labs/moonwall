import type { RepoSpec } from "@moonwall/types";
export declare function allRepos(): RepoSpec[];
export declare function allReposAsync(): Promise<RepoSpec[]>;
export declare function standardRepos(): RepoSpec[];
export default allRepos;
