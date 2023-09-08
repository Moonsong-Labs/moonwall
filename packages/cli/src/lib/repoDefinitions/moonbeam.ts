import { RepoSpec } from "@moonwall/types";

const repo: RepoSpec = {
  name: "moonbeam",
  binaries: [
    { name: "moonbeam" },
    { name: "moonbase-runtime" },
    { name: "moonbeam-runtime" },
    { name: "moonriver-runtime" },
  ],
  ghAuthor: "moonbeam-foundation",
  ghRepo: "moonbeam",
};

export default repo;
