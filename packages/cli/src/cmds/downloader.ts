import fs from "node:fs/promises";
import path from "path";
import fetch from "node-fetch";
import chalk from "chalk";
import { runTask } from "../internal/runner.js";

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

export async function downloader(args) {
  //   const command = {
  //     folder: args.path,
  //     artifact: args.artifact,
  //     version: args.binVersion,
  //   };

  if (!supportedBinaries.includes(args.artifact)) {
    throw new Error(`Downloading ${args.artifact} unsupported`);
  }

  // download folder doesnt exist make it
  if (await fs.access(args.path).catch(() => true)) {
    console.log("Folder not exists, creating");
    fs.mkdir(args.path);
  }

  const binary = args.artifact;
  const repoName = args.artifact.includes("-runtime")
    ? "moonbeam"
    : args.artifact;
  const enteredPath = args.path ? args.path : "tmp/";
  const binaryPath = path.join("./", enteredPath, binary);

  const releases = (await (await fetch(repos[repoName])).json()) as any[];
  const release = args.artifact.includes("-runtime")
    ? releases.find((release) => {
        if (args.binVersion === "latest") {
          return release.assets.find((asset) => asset.name.includes(binary));
        } else {
          return release.assets.find(
            (asset) => asset.name === `${binary}-${args.binVersion}.wasm`
          );
        }
      })
    : args.binVersion === "latest"
    ? releases.find((release) =>
        release.assets.find((asset) => asset.name === binary)
      )
    : releases
        .filter((release) => release.tag_name.includes("v" + args.binVersion))
        .find((release) =>
          release.assets.find((asset) => asset.name === binary)
        );

  if (release == null) {
    throw new Error(`Release not found for ${args.binVersion}`);
  }

  process.stdout.write(`Downloading ${binary} ${args.binVersion} ....`);
  const asset = args.artifact.includes("-runtime")
    ? release.assets.find(
        (asset) => asset.name.includes(binary) && asset.name.includes("wasm")
      )
    : release.assets.find((asset) => asset.name === binary);
  const response = await fetch(asset.browser_download_url);
  if (!response.ok) {
    throw new Error(`unexpected response ${response.statusText}`);
  }

  if (binary == "moonbeam" || binary == "polkadot") {
    await fs.writeFile(binaryPath, response.body);
    await fs.chmod(binaryPath, "755");
    process.stdout.write(` ${chalk.green("done")} ✓\n`);
    process.stdout.write(`Checking ${binaryPath} ...`);
    const version = (await runTask(`./${binaryPath} --version`)).trim();
    process.stdout.write(` ${chalk.green(version.trim())} ✓\n`);
  }

  if (binary.includes("-runtime")) {
    const binaryPath = path.join(
      "./",
      args.path,
      `${args.artifact}-${args.binVersion}.wasm`
    );
    await fs.writeFile(binaryPath, response.body);
    await fs.chmod(binaryPath, "755");
    process.stdout.write(` ${chalk.green("done")} ✓\n`);
  }
}
