import fs from "node:fs/promises";
import path from "path";
import fetch from "node-fetch";
import semver from "semver";
import chalk from "chalk";
import { runTask } from "../processHelpers.js";
import { downloader } from "./downloader.js";
import { release } from "node:os";

type NetworkArtifacts = {
  network: string;
  binaries: string[];
  repo: string;
};

// TODO: move to config
// Maybe even make a class with methods to fetch binaries
const Artifacts: NetworkArtifacts[] = [
  {
    network: "moonbeam",
    binaries: ["moonbeam", "moonbase-runtime", "moonbeam-runtime", "moonriver-runtime"],
    repo: "https://api.github.com/repos/purestake/moonbeam/releases",
  },
  {
    network: "polkadot",
    binaries: ["polkadot"],
    repo: "https://api.github.com/repos/paritytech/polkadot/releases",
  },
  {
    network: "tanssi",
    binaries: [
      "tanssi-node",
      "container-chain-template-simple-node",
      "container-chain-template-frontier-node",
    ],
    repo: "https://api.github.com/repos/moondance-labs/tanssi/releases",
  },
];

export async function fetchArtifact(args) {
  if (await fs.access(args.path).catch(() => true)) {
    console.log("Folder not exists, creating");
    fs.mkdir(args.path);
  }

  const binary = args.bin;
  const result = Artifacts.find((network) => network.binaries.includes(binary));
  if (!result) {
    throw new Error(`Downloading ${binary} unsupported`);
  }
  const url = result.repo;
  const enteredPath = args.path ? args.path : "tmp/";
  const binaryPath = path.join("./", enteredPath, binary);

  const releases = (await (await fetch(url)).json()) as Release[];
  const release = binary.includes("-runtime")
    ? releases.find((release) => {
        if (args.ver === "latest") {
          return release.assets.find((asset) => asset.name.includes(binary));
        } else {
          return release.assets.find((asset) => asset.name === `${binary}-${args.ver}.wasm`);
        }
      })
    : args.ver === "latest"
    ? releases.find((release) => release.assets.find((asset) => asset.name === binary))
    : releases
        .filter((release) => release.tag_name.includes("v" + args.ver))
        .find((release) => release.assets.find((asset) => asset.name === binary));

  if (release == null) {
    throw new Error(`Release not found for ${args.ver}`);
  }

  const asset = binary.includes("-runtime")
    ? release.assets.find((asset) => asset.name.includes(binary) && asset.name.includes("wasm"))
    : release.assets.find((asset) => asset.name === binary);

  if (!binary.includes("-runtime")) {
    await downloader(asset!.browser_download_url, binaryPath);
    await fs.chmod(binaryPath, "755");
    const version = (await runTask(`./${binaryPath} --version`)).trim();
    process.stdout.write(` ${chalk.green(version.trim())} ✓\n`);
  } else {
    const binaryPath = path.join("./", args.path, `${args.bin}-${args.ver}.wasm`);
    await downloader(asset!.browser_download_url, binaryPath);
    await fs.chmod(binaryPath, "755");
    process.stdout.write(` ${chalk.green("done")} ✓\n`);
  }
}

export async function getVersions(name: string, runtime: boolean = false) {
  const result = Artifacts.find((network) => network.binaries.includes(name));
  if (!result) {
    throw new Error(`Network not found for ${name}`);
  }
  const url = result.repo;
  const releases = (await (await fetch(url)).json()) as Release[];
  const versions = releases
    .map((release) => {
      let tag = release.tag_name;
      if (release.tag_name.includes("v")) {
        tag = tag.split("v")[1];
      }
      if (tag.includes("-rc")) {
        tag = tag.split("-rc")[0];
      }
      return tag;
    })
    .filter(
      (version) =>
        (runtime && version.includes("runtime")) || (!runtime && !version.includes("runtime"))
    )
    .map((version) => version.replace("runtime-", ""));

  const set = new Set(versions);
  return runtime
    ? [...set]
    : [...set].sort((a, b) => (semver.valid(a) && semver.valid(b) ? semver.rcompare(a, b) : a));
}

export interface Release {
  url: string;
  assets_url: string;
  html_url: string;
  id: number;
  author: Author;
  tag_name: string;
  name: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  assets: Asset[];
  tarball_url: string;
  zipball_url: string;
  body: string;
}

export interface Author {
  login: string;
  id: number;
  url: string;
  repos_url: string;
  type: string;
}

export interface Asset {
  url: string;
  id: number;
  name: string;
  label?: string;
  uploader: Uploader;
  content_type: string;
  state: string;
  size: number;
  created_at: string;
  updated_at: string;
  browser_download_url: string;
}

export interface Uploader {
  login: string;
  id: number;
  node_id: string;
  url: string;
  html_url: string;
}
