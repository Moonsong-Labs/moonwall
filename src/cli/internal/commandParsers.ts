import type {
  ChopsticksLaunchSpec,
  DevLaunchSpec,
  RepoSpec,
  ZombieLaunchSpec,
  LaunchOverrides,
  ForkConfig,
} from "../../api/types/index.js";
import { createLogger } from "../../internal/logger.js";
import path from "node:path";
import net from "node:net";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, readdir } from "node:fs/promises";
import { Effect } from "effect";
import { regex } from "arkregex";
import { standardRepos } from "../lib/repoDefinitions/index.js";
import invariant from "tiny-invariant";

/** Matches --chain=<name> or --chain <name> in CLI arguments */
const chainArgRegex = regex("--chain[=\\s]?(\\S+)");

const logger = createLogger({ name: "commandParsers" });

const hashFile = async (filePath: string): Promise<string> => {
  const hash = createHash("sha256");

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("end", () => resolve());
    stream.once("error", reject);
  });

  return hash.digest("hex");
};

const getWarmStartupCacheArtifacts = async (config: {
  binPath: string;
  chainArg?: string;
  cacheDir: string;
  isDevMode: boolean;
  needsRawChainSpec: boolean;
}): Promise<
  | {
      precompiledPath: string;
      rawChainSpecPath?: string;
    }
  | undefined
> => {
  try {
    const binaryHash = await hashFile(config.binPath);
    const shortHash = binaryHash.substring(0, 12);
    const chainName =
      config.isDevMode ? "dev" : config.chainArg?.match(chainArgRegex)?.[1] || "default";
    const binName = path.basename(config.binPath);
    const cacheSubDir = path.join(config.cacheDir, `${binName}-${chainName}-${shortHash}`);
    const hashPath = path.join(cacheSubDir, "binary.hash");
    const rawChainSpecPath = path.join(cacheSubDir, `${chainName}-raw.json`);

    await access(cacheSubDir);
    const savedHash = (await readFile(hashPath, "utf8")).trim();
    if (savedHash !== binaryHash) {
      return undefined;
    }

    const files = await readdir(cacheSubDir);
    const precompiledFile = files.find(
      (file) =>
        file.startsWith("precompiled_wasm_") || file.endsWith(".cwasm") || file.endsWith(".wasm")
    );

    if (!precompiledFile) {
      return undefined;
    }

    if (config.needsRawChainSpec) {
      await access(rawChainSpecPath);
    }

    return {
      precompiledPath: path.join(cacheSubDir, precompiledFile),
      rawChainSpecPath: config.needsRawChainSpec ? rawChainSpecPath : undefined,
    };
  } catch {
    return undefined;
  }
};

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

  private applyStartupCacheArtifacts(
    result: { precompiledPath: string; rawChainSpecPath?: string; fromCache?: boolean },
    hasDevFlag: boolean,
    existingChainName?: string
  ): void {
    const precompiledDir = path.dirname(result.precompiledPath);
    this.overrideArg(`--wasmtime-precompiled=${precompiledDir}`);

    if (result.rawChainSpecPath) {
      if (hasDevFlag) {
        this.args = this.args.filter((arg) => arg !== "--dev");
        this.overrideArg(`--chain=${result.rawChainSpecPath}`);
        this.overrideArg("--alice");
        this.overrideArg("--force-authoring");
        this.overrideArg("--rpc-cors=all");
        this.overrideArg(
          "--node-key=0000000000000000000000000000000000000000000000000000000000000001"
        );
      } else if (existingChainName) {
        this.overrideArg(`--chain=${result.rawChainSpecPath}`);
      }
      logger.debug(`Using raw chain spec for ~10x faster startup: ${result.rawChainSpecPath}`);
    }

    process.env.MOONWALL_CACHE_DIR = precompiledDir;

    logger.debug(
      result.fromCache === false
        ? `Precompiled WASM created: ${result.precompiledPath}`
        : `Using cached precompiled WASM: ${result.precompiledPath}`
    );
  }

  /**
   * Cache startup artifacts if enabled in launchSpec.
   * This uses an Effect-based service that caches artifacts by binary hash.
   *
   * When cacheStartupArtifacts is enabled, this generates:
   * 1. Precompile the runtime WASM to native code using `precompile-wasm`
   * 2. Generate a raw chain spec to skip genesis WASM compilation
   *
   * This reduces startup from ~3s to ~200ms (~10x improvement).
   */
  async withStartupCache(): Promise<LaunchCommandParser> {
    // Skip for Docker images
    if (this.launchSpec.useDocker) {
      if (this.launchSpec.cacheStartupArtifacts) {
        logger.warn("Startup caching is not supported for Docker images, skipping");
      }
      return this;
    }

    // Extract chain argument from existing args (e.g., "--chain=moonbase-dev")
    const chainArg = this.args.find((arg) => arg.startsWith("--chain"));
    // Check if using --dev flag
    const hasDevFlag = this.args.includes("--dev");
    // Extract chain name from --chain=XXX or --chain XXX
    const existingChainName = chainArg?.match(chainArgRegex)?.[1];

    // We can generate raw chain spec for both --dev mode and explicit --chain=XXX
    const canGenerateRawSpec = hasDevFlag || !!existingChainName;

    const cacheDir =
      this.launchSpec.startupCacheDir || path.join(process.cwd(), "tmp", "startup-cache");

    const warmCacheArtifacts = await getWarmStartupCacheArtifacts({
      binPath: this.launchSpec.binPath,
      chainArg,
      cacheDir,
      isDevMode: hasDevFlag,
      needsRawChainSpec: canGenerateRawSpec,
    });

    if (warmCacheArtifacts) {
      this.applyStartupCacheArtifacts(
        { ...warmCacheArtifacts, fromCache: true },
        hasDevFlag,
        existingChainName
      );
      return this;
    }

    if (!this.launchSpec.cacheStartupArtifacts) {
      return this;
    }

    try {
      const { StartupCacheService, StartupCacheServiceLive } = await import(
        "../../services/cache/StartupCacheService.js"
      );

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

      const result = await Effect.runPromise(program);
      this.applyStartupCacheArtifacts(result, hasDevFlag, existingChainName);
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
 * Get a free port using OS ephemeral port allocation.
 * Binds to port 0 (OS picks a free port), reads the assigned port, then releases it.
 * The ephemeral range (typically 32768–60999) avoids conflicts with well-known service ports.
 *
 * Note: There is an inherent TOCTOU window between releasing the port here and the node
 * binding to it. This is accepted because --rpc-port=0 (atomic allocation) is not viable —
 * nodes that restart their RPC server during init (forking, Tanssi) rebind to a different
 * random port, making the discovered port stale. Pre-allocating ensures a stable port.
 */
export const getFreePort = async (): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("Could not determine assigned port")));
        return;
      }
      const port = addr.port;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
};
