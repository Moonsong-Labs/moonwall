import { ChopsticksLaunchSpec, DevLaunchSpec, RepoSpec, ZombieLaunchSpec } from "@moonwall/types";
import chalk from "chalk";
import path from "path";
import { standardRepos } from "../lib/repoDefinitions";
import getPort from "get-port";

export function parseZombieCmd(launchSpec: ZombieLaunchSpec) {
  if (launchSpec) {
    return { cmd: launchSpec.configPath };
  } else {
    throw new Error(
      `No ZombieSpec found in config. \n Are you sure your ${chalk.bgWhiteBright.blackBright(
        "moonwall.config.json"
      )} file has the correct "configPath" in zombieSpec?`
    );
  }
}

function fetchDefaultArgs(binName: string, additionalRepos: RepoSpec[] = []): string[] {
  let defaultArgs: string[] | undefined;

  const repos = [...standardRepos(), ...additionalRepos];
  for (const repo of repos) {
    const foundBin = repo.binaries.find((bin) => bin.name === binName);
    if (foundBin) {
      defaultArgs = foundBin.defaultArgs;
      break;
    }
  }

  if (!defaultArgs) {
    defaultArgs = ["--dev"];
  }

  return defaultArgs;
}

export async function parseRunCmd(launchSpec: DevLaunchSpec, additionalRepos?: RepoSpec[]) {
  const launch = !launchSpec.running ? true : launchSpec.running;
  const cmd = launchSpec.binPath;
  const args = launchSpec.options
    ? [...launchSpec.options]
    : fetchDefaultArgs(path.basename(launchSpec.binPath), additionalRepos);

  if (launchSpec.ports) {
    const ports = launchSpec.ports;
    if (ports.p2pPort) {
      args.push(`--port=${ports.p2pPort}`);
    }
    if (ports.wsPort) {
      args.push(`--ws-port=${ports.wsPort}`);
    }
    if (ports.rpcPort) {
      args.push(`--rpc-port=${ports.rpcPort}`);
    }
  } else {
    const freePort = (await getFreePort()).toString();
    process.env.MOONWALL_RPC_PORT = freePort;

    if (launchSpec.newRpcBehaviour) {
      args.push(`--rpc-port=${freePort}`);
    } else {
      args.push(`--ws-port=${freePort}`);
    }
  }
  return { cmd, args, launch };
}

export const getFreePort = async () => {
  const notionalPort = 10000 + Number(process.env.VITEST_POOL_ID || 1) * 100;
  return getPort({ port: notionalPort });
};

export function parseChopsticksRunCmd(launchSpecs: ChopsticksLaunchSpec[]): {
  cmd: string;
  args: string[];
  launch: boolean;
} {
  const launch = !launchSpecs[0].running ? true : launchSpecs[0].running;
  if (launchSpecs.length === 1) {
    const chopsticksCmd = "node";
    const chopsticksArgs = [
      "node_modules/@acala-network/chopsticks/chopsticks.cjs",
      `--config=${launchSpecs[0].configPath}`,
    ];

    const mode = launchSpecs[0].buildBlockMode ? launchSpecs[0].buildBlockMode : "manual";
    const num = mode == "batch" ? "Batch" : mode == "instant" ? "Instant" : "Manual";
    chopsticksArgs.push(`--build-block-mode=${num}`);

    if (launchSpecs[0].wsPort) {
      chopsticksArgs.push(`--port=${launchSpecs[0].wsPort}`);
    }

    if (launchSpecs[0].wasmOverride) {
      chopsticksArgs.push(`--wasm-override=${launchSpecs[0].wasmOverride}`);
    }

    if (launchSpecs[0].allowUnresolvedImports) {
      chopsticksArgs.push("--allow-unresolved-imports");
    }

    return {
      cmd: chopsticksCmd,
      args: chopsticksArgs,
      launch,
    };
  }

  const chopsticksCmd = "node";
  const chopsticksArgs = ["node_modules/@acala-network/chopsticks/chopsticks.cjs", "xcm"];

  launchSpecs.forEach((spec) => {
    const type = spec.type ? spec.type : "parachain";
    switch (type) {
      case "parachain":
        chopsticksArgs.push(`--parachain=${spec.configPath}`);
        break;
      case "relaychain":
        chopsticksArgs.push(`--relaychain=${spec.configPath}`);
    }
  });

  return {
    cmd: chopsticksCmd,
    args: chopsticksArgs,
    launch,
  };
}
