import type {
  ChopsticksLaunchSpec,
  DevLaunchSpec,
  RepoSpec,
  ZombieLaunchSpec,
  LaunchOverrides,
  ForkConfig,
} from "@moonwall/types";
import { createLogger } from "@moonwall/util";
import path from "node:path";
import net from "node:net";
import { Effect } from "effect";
import { standardRepos } from "../lib/repoDefinitions";
import { shardManager } from "../lib/shardManager";
import invariant from "tiny-invariant";
import {
  StartupCacheService,
  StartupCacheServiceLive,
} from "./effect/StartupCacheService.js";

const logger = createLogger({ name: "commandParsers" });

export function parseZombieCmd(launchSpec: ZombieLaunchSpec) {
  if (launchSpec) {
    return { cmd: launchSpec.configPath };
  }
  throw new Error(
    "No ZombieSpec found in config. Are you sure your moonwall.config.json file has the correct 'configPath' in zombieSpec?"
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
    // In RECYCLE mode, the node is already running
    if (process.env.MOON_RECYCLE === "true") {
      const existingPort = process.env.MOONWALL_RPC_PORT;
      if (existingPort) {
        this.overrideArg(`--rpc-port=${existingPort}`);
      }
      return this;
    }

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
    logger.debug(`Command to run: ${this.cmd}`);
    logger.debug(`Arguments: ${this.args.join(" ")}`);
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

  /**
   * Cache startup artifacts if enabled in launchSpec.
   * This uses an Effect-based service that caches artifacts by binary hash.
   *
   * When cacheStartupArtifacts is enabled, this generates:
   * 1. Precompiled WASM for the runtime
   * 2. Raw chain spec to skip genesis WASM compilation
   *
   * This reduces startup from ~3s to ~200ms (~10x improvement).
   */
  async withStartupCache(): Promise<LaunchCommandParser> {
    if (!this.launchSpec.cacheStartupArtifacts) {
      return this;
    }

    // Skip for Docker images
    if (this.launchSpec.useDocker) {
      logger.warn("Startup caching is not supported for Docker images, skipping");
      return this;
    }

    // Extract chain argument from existing args (e.g., "--chain=moonbase-dev")
    const chainArg = this.args.find((arg) => arg.startsWith("--chain"));
    // Check if using --dev flag
    const hasDevFlag = this.args.includes("--dev");
    // Extract chain name from --chain=XXX or --chain XXX
    const existingChainName = chainArg?.match(/--chain[=\s]?(\S+)/)?.[1];

    // We can generate raw chain spec for both --dev mode and explicit --chain=XXX
    const canGenerateRawSpec = hasDevFlag || !!existingChainName;

    const cacheDir =
      this.launchSpec.startupCacheDir || path.join(process.cwd(), "tmp", "startup-cache");

    const program = StartupCacheService.pipe(
      Effect.flatMap((service) =>
        service.getCachedArtifacts({
          binPath: this.launchSpec.binPath,
          chainArg,
          cacheDir,
          // Generate raw chain spec for faster startup (works for both --dev and --chain=XXX)
          generateRawChainSpec: canGenerateRawSpec,
          // Pass dev mode flag for proper chain name detection
          isDevMode: hasDevFlag,
        })
      ),
      Effect.provide(StartupCacheServiceLive)
    );

    try {
      const result = await Effect.runPromise(program);
      // --wasmtime-precompiled expects a DIRECTORY, not a file path
      // Get the directory containing the precompiled wasm
      const precompiledDir = path.dirname(result.precompiledPath);
      this.overrideArg(`--wasmtime-precompiled=${precompiledDir}`);

      // If we have a raw chain spec, use it for ~10x faster startup
      if (result.rawChainSpecPath) {
        if (hasDevFlag) {
          // Remove --dev flag and add equivalent flags
          this.args = this.args.filter((arg) => arg !== "--dev");
          this.overrideArg(`--chain=${result.rawChainSpecPath}`);
          // Add flags that --dev would normally set
          this.args.push("--alice");
          this.args.push("--force-authoring");
          this.overrideArg("--rpc-cors=all");
          // Use a deterministic node key for consistency
          this.overrideArg(
            "--node-key=0000000000000000000000000000000000000000000000000000000000000001"
          );
        } else if (existingChainName) {
          // Replace original --chain=XXX with --chain=<raw-spec-path>
          this.overrideArg(`--chain=${result.rawChainSpecPath}`);
        }
        logger.debug(`Using raw chain spec for ~10x faster startup: ${result.rawChainSpecPath}`);
      }

      logger.debug(
        result.fromCache
          ? `Using cached precompiled WASM: ${result.precompiledPath}`
          : `Precompiled WASM created: ${result.precompiledPath}`
      );
    } catch (error) {
      // Log warning but continue without precompilation
      logger.warn(`WASM precompilation failed, continuing without: ${error}`);
    }

    return this;
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
      .then((p) => p.withDefaultForkConfig().withLaunchOverrides())
      .then((p) => p.withStartupCache());

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

  logger.debug(
    `Port calculation: shard=${shardIndex + 1}/${totalShards}, pool=${poolId}, final=${startPort}`
  );

  return getNextAvailablePort(startPort);
};
