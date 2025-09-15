import "@moonbeam-network/api-augment";
import path from "node:path";
import fs from "node:fs";
import child_process from "node:child_process";
import { OVERRIDE_RUNTIME_PATH } from "@moonwall/util";
export const BINARY_DIRECTORY = process.env.BINARY_DIRECTORY || "binaries";
export const RUNTIME_DIRECTORY = process.env.RUNTIME_DIRECTORY || "runtimes";
export const SPECS_DIRECTORY = process.env.SPECS_DIRECTORY || "specs";
export async function getGithubReleaseBinary(url, binaryPath) {
  if (!fs.existsSync(binaryPath)) {
    console.log(`     Missing ${binaryPath} locally, downloading it...`);
    child_process.execSync(
      `mkdir -p ${path.dirname(binaryPath)} &&` +
        ` wget -q ${url}` +
        ` -O ${binaryPath} &&` +
        ` chmod u+x ${binaryPath}`
    );
    console.log(`${binaryPath} downloaded !`);
  }
  return binaryPath;
}
// Downloads the binary and return the filepath
export async function getMoonbeamReleaseBinary(binaryTag) {
  const binaryPath = path.join(BINARY_DIRECTORY, `moonbeam-${binaryTag}`);
  return getGithubReleaseBinary(
    `https://github.com/PureStake/moonbeam/releases/download/${binaryTag}/moonbeam`,
    binaryPath
  );
}
export async function getPolkadotReleaseBinary(binaryTag) {
  const binaryPath = path.join(BINARY_DIRECTORY, `polkadot-${binaryTag}`);
  return getGithubReleaseBinary(
    `https://github.com/paritytech/polkadot-sdk/releases/download/${binaryTag}/polkadot`,
    binaryPath
  );
}
export async function getTanssiReleaseBinary(binaryTag) {
  const binaryPath = path.join(BINARY_DIRECTORY, `polkadot-${binaryTag}`);
  return getGithubReleaseBinary(
    `https://github.com/moondance-labs/tanssi/releases/download/${binaryTag}/polkadot`,
    binaryPath
  );
}
export async function getTagSha8(binaryTag) {
  const sha = child_process.execSync(`git rev-list -1 ${binaryTag}`).toString();
  if (!sha) {
    throw new Error(`Invalid runtime tag ${binaryTag}`);
  }
  return sha.slice(0, 8);
}
export async function getMoonbeamDockerBinary(binaryTag) {
  const sha8 = await getTagSha8(binaryTag);
  const binaryPath = path.join(BINARY_DIRECTORY, `moonbeam-${sha8}`);
  if (!fs.existsSync(binaryPath)) {
    if (process.platform !== "linux") {
      console.error("docker binaries are only supported on linux.");
      throw new Error("docker binaries are only supported on linux.");
    }
    const dockerImage = `purestake/moonbeam:sha-${sha8}`;
    console.log(`     Missing ${binaryPath} locally, downloading it...`);
    child_process.execSync(`mkdir -p ${path.dirname(binaryPath)} && \
          docker create --pull always --name moonbeam-tmp ${dockerImage} && \
          docker cp moonbeam-tmp:/moonbeam/moonbeam ${binaryPath} && \
          docker rm moonbeam-tmp`);
    console.log(`${binaryPath} downloaded !`);
  }
  return binaryPath;
}
// Downloads the runtime and return the filepath
export async function getRuntimeWasm(runtimeName, runtimeTag, localPath) {
  const runtimePath = path.join(RUNTIME_DIRECTORY, `${runtimeName}-${runtimeTag}.wasm`);
  if (!fs.existsSync(RUNTIME_DIRECTORY)) {
    fs.mkdirSync(RUNTIME_DIRECTORY, { recursive: true });
  }
  if (runtimeTag === "local") {
    const builtRuntimePath = localPath
      ? localPath
      : path.join(
          OVERRIDE_RUNTIME_PATH || `../target/release/wbuild/${runtimeName}-runtime/`,
          `${runtimeName}_runtime.compact.compressed.wasm`
        );
    const code = fs.readFileSync(builtRuntimePath);
    fs.writeFileSync(runtimePath, `0x${code.toString("hex")}`);
  } else if (!fs.existsSync(runtimePath)) {
    console.log(`     Missing ${runtimePath} locally, downloading it...`);
    child_process.execSync(
      `mkdir -p ${path.dirname(runtimePath)} && wget -q https://github.com/PureStake/moonbeam/releases/download/${runtimeTag}/${runtimeName}-${runtimeTag}.wasm -O ${runtimePath}.bin`
    );
    const code = fs.readFileSync(`${runtimePath}.bin`);
    fs.writeFileSync(runtimePath, `0x${code.toString("hex")}`);
    console.log(`${runtimePath} downloaded !`);
  }
  return runtimePath;
}
export async function getPlainSpecsFromTag(runtimeName, tag) {
  const binaryPath = await getMoonbeamDockerBinary(tag);
  return generateSpecs(binaryPath, runtimeName, false);
}
export async function getRawSpecsFromTag(runtimeName, tag) {
  const binaryPath = await getMoonbeamDockerBinary(tag);
  return generateSpecs(binaryPath, runtimeName, true);
}
async function generateSpecs(binaryPath, runtimeName, raw) {
  const specPath = path.join(SPECS_DIRECTORY, `${runtimeName}-${raw ? "raw" : "plain"}-specs.json`);
  child_process.execSync(
    `mkdir -p ${path.dirname(specPath)} && ` +
      `${binaryPath} build-spec --chain ${runtimeName} ` +
      `${raw ? "--raw" : ""} --disable-default-bootnode > ${specPath}`
  );
  return specPath;
}
export async function generatePlainSpecs(binaryPath, runtimeName) {
  return generateSpecs(binaryPath, runtimeName, false);
}
export async function generateRawSpecs(binaryPath, runtimeName) {
  return generateSpecs(binaryPath, runtimeName, true);
}
//# sourceMappingURL=binariesHelpers.js.map
