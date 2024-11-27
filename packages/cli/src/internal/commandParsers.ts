import type {
  ChopsticksLaunchSpec,
  DevLaunchSpec,
  RepoSpec,
  ZombieLaunchSpec,
} from "@moonwall/types";
import chalk from "chalk";
import path from "node:path";
import { standardRepos } from "../lib/repoDefinitions";
import invariant from "tiny-invariant";

export function parseZombieCmd(launchSpec: ZombieLaunchSpec) {
  if (launchSpec) {
    return { cmd: launchSpec.configPath };
  }
  throw new Error(
    `No ZombieSpec found in config. \n Are you sure your ${chalk.bgWhiteBright.blackBright(
      "moonwall.config.json"
    )} file has the correct "configPath" in zombieSpec?`
  );
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

  const overrideArg = (newArg: string) => {
    const newArgKey = newArg.split("=")[0];
    const existingIndex = args.findIndex((arg) => arg.startsWith(`${newArgKey}=`));

    if (existingIndex !== -1) {
      args[existingIndex] = newArg;
    } else {
      args.push(newArg);
    }
  };

  if (launchSpec.ports) {
    const ports = launchSpec.ports;
    if (ports.p2pPort) {
      overrideArg(`--port=${ports.p2pPort}`);
    }
    if (ports.wsPort) {
      overrideArg(`--ws-port=${ports.wsPort}`);
    }
    if (ports.rpcPort) {
      overrideArg(`--rpc-port=${ports.rpcPort}`);
    }
  } else {
    const freePort = (await getFreePort()).toString();
    process.env.MOONWALL_RPC_PORT = freePort;

    if (launchSpec.newRpcBehaviour) {
      overrideArg(`--rpc-port=${freePort}`);
    } else {
      overrideArg(`--ws-port=${freePort}`);
    }
  }

  const forkOptions = launchSpec.defaultForkConfig;

  console.log("forkOptions");
  console.dir(forkOptions, { depth: null });
  if (forkOptions) {
    if (forkOptions.url) {
      invariant(forkOptions.url.startsWith("http"), "Fork URL must start with http:// or https://");
      overrideArg(`--fork-chain-from-rpc=${forkOptions.url}`);
    }
    if (forkOptions.blockNumber) {
      overrideArg(`--block=${forkOptions.blockNumber}`);
    }
    if (forkOptions.stateOverridePath) {
      overrideArg(`--fork-state-overrides=${forkOptions.stateOverridePath}`);
    }
    if (forkOptions.verbose) {
      overrideArg("-llazy-loading=trace");
    }
  }

  console.log("post args");
  console.log(args);
  return { cmd, args, launch };
}

export const getFreePort = async () => {
  const notionalPort = 10000 + Number(process.env.VITEST_POOL_ID || 1) * 100;
  // return getPort({ port: notionalPort });
  return notionalPort;
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
      `--addr=${launchSpecs[0].address ?? "127.0.0.1"}`, // use old behaviour by default
    ];

    const mode = launchSpecs[0].buildBlockMode ? launchSpecs[0].buildBlockMode : "manual";
    const num = mode === "batch" ? "Batch" : mode === "instant" ? "Instant" : "Manual";
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

  for (const spec of launchSpecs) {
    const type = spec.type ? spec.type : "parachain";
    switch (type) {
      case "parachain":
        chopsticksArgs.push(`--parachain=${spec.configPath}`);
        break;
      case "relaychain":
        chopsticksArgs.push(`--relaychain=${spec.configPath}`);
    }
  }

  return {
    cmd: chopsticksCmd,
    args: chopsticksArgs,
    launch,
  };
}
