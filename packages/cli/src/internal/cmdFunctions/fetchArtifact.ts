import fs from "node:fs/promises";
import path from "path";
import fetch from "node-fetch";
import semver from "semver";
import chalk from "chalk";
import { runTask } from "../processHelpers.js";
import { downloader } from "./downloader.js";

const supportedBinaries = [
  "moonbeam",
  "polkadot",
  "moonbase-runtime",
  "moonbeam-runtime",
  "moonriver-runtime",
];

const repos = {
  moonbeam: "https://api.github.com/repos/purestake/moonbeam/releases",
  polkadot: "https://api.github.com/repos/paritytech/polkadot/releases",
};

export async function fetchArtifact(args) {
  if (!supportedBinaries.includes(args.bin)) {
    throw new Error(`Downloading ${args.bin} unsupported`);
  }

  if (await fs.access(args.path).catch(() => true)) {
    console.log("Folder not exists, creating");
    fs.mkdir(args.path);
  }

  const binary = args.bin;
  const repoName = args.bin.includes("-runtime") ? "moonbeam" : args.bin;
  const enteredPath = args.path ? args.path : "tmp/";
  const binaryPath = path.join("./", enteredPath, binary);

  const releases = (await (await fetch(repos[repoName])).json()) as any[];
  const release = args.bin.includes("-runtime")
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

  const asset = args.bin.includes("-runtime")
    ? release.assets.find((asset) => asset.name.includes(binary) && asset.name.includes("wasm"))
    : release.assets.find((asset) => asset.name === binary);

  if (binary == "moonbeam" || binary == "polkadot") {
    await downloader(asset.browser_download_url, binaryPath);
    await fs.chmod(binaryPath, "755");
    const version = (await runTask(`./${binaryPath} --version`)).trim();
    process.stdout.write(` ${chalk.green(version.trim())} ✓\n`);
  }

  if (binary.includes("-runtime")) {
    const binaryPath = path.join("./", args.path, `${args.bin}-${args.ver}.wasm`);
    await downloader(asset.browser_download_url, binaryPath);
    await fs.chmod(binaryPath, "755");
    process.stdout.write(` ${chalk.green("done")} ✓\n`);
  }
}

export async function getVersions(name: string, runtime: boolean = false) {
  const repoName = name
    .replace("-runtime", "")
    .replace("moonbase", "moonbeam")
    .replace("moonriver", "moonbeam");
  const releases = (await (await fetch(repos[repoName])).json()) as any[];
  const versions = releases
    .map((release) => release.tag_name.replace("v", "").split("-rc")[0])
    .filter(
      (version) =>
        (runtime && version.includes("runtime")) || (!runtime && !version.includes("runtime"))
    )
    .map((version) => version.replace("runtime-", ""));
  const set = new Set(versions);
  return runtime ? [...set] : [...set].sort((a, b) => semver.rcompare(a, b));
}
