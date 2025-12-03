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
import net from "node:net";
import { standardRepos } from "../lib/repoDefinitions";
import { shardManager } from "../lib/shardManager";
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

export class LaunchCommandParser {
  private args: string[];
  private cmd: string;
  private launch: boolean;
  private launchSpec: DevLaunchSpec;
  private launchOverrides?: LaunchOverrides;

  constructor(options: {
    launchSpec: DevLaunchSpec;
    additionalRepos?: RepoSpec[];
    launchOverrides?: LaunchOverrides;
  }) {
    const { launchSpec, additionalRepos, launchOverrides } = options;
    this.launchSpec = launchSpec;
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
      const freePort = (await getFreePort()).toString();
      // Always pin the rpc port so the provider endpoint matches exactly the spawned node.
      process.env.MOONWALL_RPC_PORT = freePort;
      this.overrideArg(`--rpc-port=${freePort}`);
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
    const parsed = await parser
      .withPorts()
      .then((p) => p.withDefaultForkConfig().withLaunchOverrides());

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
      `--host=${launchSpecs[0].address ?? "127.0.0.1"}`,
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
 * Check if a port is available for use
 */
const isPortAvailable = async (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once("close", () => resolve(true));
      server.close();
    });
    server.on("error", () => resolve(false));
  });
};

/**
 * Get the next available port starting from a given port
 */
const getNextAvailablePort = async (startPort: number): Promise<number> => {
  let port = startPort;
  while (port <= 65535) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error(`No available ports found starting from ${startPort}`);
};

/**
 * Get a free port with availability checking
 * Uses async port allocation for better collision avoidance
 */
export const getFreePort = async (): Promise<number> => {
  // Get shard information from centralized manager
  const shardIndex = shardManager.getShardIndex();
  const totalShards = shardManager.getTotalShards();

  // Use VITEST_POOL_ID as additional offset if available
  const poolId = parseInt(process.env.VITEST_POOL_ID || "0", 10);

  // Calculate port with better isolation between shards
  // Base port 10000 + (shard * 1000) + (pool * 100) + deterministic offset
  const basePort = 10000;
  const shardOffset = shardIndex * 1000;
  const poolOffset = poolId * 100;

  // Use a deterministic but unique offset based on environment
  const processOffset = process.pid % 50;

  const calculatedPort = basePort + shardOffset + poolOffset + processOffset;

  // Ensure we stay within a reasonable port range
  const startPort = Math.min(calculatedPort, 60000 + shardIndex * 100 + poolId);

  if (process.env.DEBUG_MOONWALL_PORTS) {
    console.log(
      `[DEBUG] Port calculation: shard=${shardIndex + 1}/${totalShards}, pool=${poolId}, final=${startPort}`
    );
  }

  return getNextAvailablePort(startPort);
};
