import fs from "node:fs/promises";
import path from "path";
import fetch from "node-fetch";
import semver from "semver";
import chalk from "chalk";
import { runTask } from "../processHelpers";
import { minimatch } from "minimatch";
import { downloader } from "./downloader";
import { allReposAsync } from "../../lib/repoDefinitions";
import { execSync } from "node:child_process";

export async function fetchArtifact(args) {
  if (await fs.access(args.path).catch(() => true)) {
    console.log("Folder not exists, creating");
    fs.mkdir(args.path);
  }

  const binary: string = args.bin;
  const repo = (await allReposAsync()).find((network) =>
    network.binaries.find((bin) => bin.name === binary)
  );

  if (!repo) {
    throw new Error(`Downloading ${binary} unsupported`);
  }
  const url = `https://api.github.com/repos/${repo.ghAuthor}/${repo.ghRepo}/releases`;
  const enteredPath = args.path ? args.path : "tmp/";
  // const binaryPath = path.join("./", enteredPath, binary);

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
        .filter((release) => release.tag_name.includes(args.ver))
        .find((release) => release.assets.find((asset) => minimatch(asset.name, binary)));

  if (release == null) {
    throw new Error(`Release not found for ${args.ver}`);
  }

  const asset = binary.includes("-runtime")
    ? release.assets.find((asset) => asset.name.includes(binary) && asset.name.includes("wasm"))
    : release.assets.find((asset) => minimatch(asset.name, binary));

  if (!binary.includes("-runtime")) {
    const url = asset!.browser_download_url;
    const filename = path.basename(url);
    const binPath = path.join("./", enteredPath, filename);

    await downloader(url, binPath);
    await fs.chmod(binPath, "755");

    if (filename.endsWith(".tar.gz")) {
      const outputBuffer = execSync(`tar -xzvf ${binPath}`);
      const cleaned = outputBuffer.toString().split("\n")[0].split("/")[0];
      const version = (await runTask(`./${cleaned} --version`)).trim();
      process.stdout.write(` ${chalk.green(version.trim())} ✓\n`);
      return;
    } else {
      const version = (await runTask(`./${binPath} --version`)).trim();
      process.stdout.write(` ${chalk.green(version.trim())} ✓\n`);
      return;
    }
  } else {
    const binaryPath = path.join("./", args.path, `${args.bin}-${args.ver}.wasm`);
    await downloader(asset!.browser_download_url, binaryPath);
    await fs.chmod(binaryPath, "755");
    process.stdout.write(` ${chalk.green("done")} ✓\n`);
    return;
  }
}

export async function getVersions(name: string, runtime: boolean = false) {
  const repo = (await allReposAsync()).find((network) =>
    network.binaries.find((bin) => bin.name === name)
  );
  if (!repo) {
    throw new Error(`Network not found for ${name}`);
  }
  const url = `https://api.github.com/repos/${repo.ghAuthor}/${repo.ghRepo}/releases`;
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
    : [...set].sort(
        (a, b) => (semver.valid(a) && semver.valid(b) ? semver.rcompare(a, b) : a) as any
      );
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
