import type {
  ChopsticksLaunchSpec,
  DevLaunchSpec,
  RepoSpec,
  ZombieLaunchSpec,
  LaunchOverrides,
  ForkConfig,
} from "@moonwall/types";
import chalk from "chalk";
import path from "node:path";
import { standardRepos } from "../lib/repoDefinitions";
import invariant from "tiny-invariant";
import { getAtomicFreePort } from "./portAllocator";

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

export class LaunchCommandParser {
  private args: string[];
  private cmd: string;
  private launch: boolean;
  private launchSpec: DevLaunchSpec;
  private additionalRepos?: RepoSpec[];
  private launchOverrides?: LaunchOverrides;

  constructor(options: {
    launchSpec: DevLaunchSpec;
    additionalRepos?: RepoSpec[];
    launchOverrides?: LaunchOverrides;
  }) {
    const { launchSpec, additionalRepos, launchOverrides } = options;
    this.launchSpec = launchSpec;
    this.additionalRepos = additionalRepos;
    this.launchOverrides = launchOverrides;
    this.launch = !launchSpec.running ? true : launchSpec.running;
    this.cmd = launchSpec.binPath;
    this.args = launchSpec.options
      ? [...launchSpec.options]
      : fetchDefaultArgs(path.basename(launchSpec.binPath), additionalRepos);
  }

  private overrideArg(newArg: string): void {
    const newArgKey = newArg.split("=")[0];
    const existingIndex = this.args.findIndex((arg) => arg.startsWith(`${newArgKey}=`));

    if (existingIndex !== -1) {
      this.args[existingIndex] = newArg;
    } else {
      this.args.push(newArg);
    }
  }

  async withPorts() {
    if (this.launchSpec.ports) {
      const ports = this.launchSpec.ports;
      if (ports.p2pPort) {
        this.overrideArg(`--port=${ports.p2pPort}`);
      }
      if (ports.wsPort) {
        this.overrideArg(`--ws-port=${ports.wsPort}`);
      }
      if (ports.rpcPort) {
        this.overrideArg(`--rpc-port=${ports.rpcPort}`);
      }
    } else {
      const freePort = (await getAtomicFreePort()).toString();
      process.env.MOONWALL_RPC_PORT = freePort;

      if (this.launchSpec.newRpcBehaviour) {
        this.overrideArg(`--rpc-port=${freePort}`);
      } else {
        this.overrideArg(`--ws-port=${freePort}`);
      }
    }
    return this;
  }

  withDefaultForkConfig(): LaunchCommandParser {
    const forkOptions = this.launchSpec.defaultForkConfig;
    if (forkOptions) {
      this.applyForkOptions(forkOptions);
    }
    return this;
  }

  withLaunchOverrides(): LaunchCommandParser {
    if (this.launchOverrides?.forkConfig) {
      this.applyForkOptions(this.launchOverrides.forkConfig);
    }
    return this;
  }

  private print() {
    console.log(chalk.cyan(`Command to run is: ${chalk.bold(this.cmd)}`));
    console.log(chalk.cyan(`Arguments are: ${chalk.bold(this.args.join(" "))}`));
    return this;
  }

  private applyForkOptions(forkOptions: ForkConfig): void {
    if (forkOptions.url) {
      invariant(forkOptions.url.startsWith("http"), "Fork URL must start with http:// or https://");
      this.overrideArg(`--fork-chain-from-rpc=${forkOptions.url}`);
    }
    if (forkOptions.blockHash) {
      this.overrideArg(`--block=${forkOptions.blockHash}`);
    }
    if (forkOptions.stateOverridePath) {
      this.overrideArg(`--fork-state-overrides=${forkOptions.stateOverridePath}`);
    }
    if (forkOptions.verbose) {
      this.overrideArg("-llazy-loading=trace");
    }
  }

  build(): { cmd: string; args: string[]; launch: boolean } {
    return {
      cmd: this.cmd,
      args: this.args,
      launch: this.launch,
    };
  }

  static async create(options: {
    launchSpec: DevLaunchSpec;
    additionalRepos?: RepoSpec[];
    launchOverrides?: LaunchOverrides;
    verbose?: boolean;
  }) {
    const parser = new LaunchCommandParser(options);
    const parsed = await parser.withPorts();
    parsed.withDefaultForkConfig().withLaunchOverrides();

    if (options.verbose) {
      parsed.print();
    }

    return parsed.build();
  }
}

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

/**
 * @deprecated Use getAtomicFreePort() instead for thread-safe port allocation
 */
export const getFreePort = () => {
  const notionalPort = 10000 + Number(process.env.VITEST_POOL_ID || 1) * 100;
  return notionalPort;
};

/**
 * Get a free port using atomic allocation to prevent race conditions
 * This is the recommended way to allocate ports for parallel node spawning
 */
export const getFreePortAsync = async () => {
  return await getAtomicFreePort();
};
