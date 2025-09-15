// src/internal/commandParsers.ts
import chalk from "chalk";
import path2 from "path";
import net from "net";

// src/lib/repoDefinitions/moonbeam.ts
var repo = {
  name: "moonbeam",
  binaries: [
    {
      name: "moonbeam",
      defaultArgs: [
        "--no-hardware-benchmarks",
        "--no-telemetry",
        "--reserved-only",
        "--rpc-cors=all",
        "--unsafe-rpc-external",
        "--unsafe-force-node-key-generation",
        "--no-grandpa",
        "--sealing=manual",
        "--force-authoring",
        "--no-prometheus",
        "--alice",
        "--chain=moonbase-dev",
        "--tmp",
      ],
    },
    { name: "moonbase-runtime" },
    { name: "moonbeam-runtime" },
    { name: "moonriver-runtime" },
  ],
  ghAuthor: "moonbeam-foundation",
  ghRepo: "moonbeam",
};
var moonbeam_default = repo;

// src/lib/repoDefinitions/polkadot.ts
var repo2 = {
  name: "polkadot",
  binaries: [
    { name: "polkadot" },
    { name: "polkadot-prepare-worker" },
    { name: "polkadot-execute-worker" },
  ],
  ghAuthor: "paritytech",
  ghRepo: "polkadot-sdk",
};
var polkadot_default = repo2;

// src/lib/repoDefinitions/tanssi.ts
var repo3 = {
  name: "tanssi",
  binaries: [
    {
      name: "tanssi-node",
      defaultArgs: ["--dev", "--sealing=manual", "--no-hardware-benchmarks"],
    },
    { name: "container-chain-template-simple-node" },
    { name: "container-chain-template-frontier-node" },
  ],
  ghAuthor: "moondance-labs",
  ghRepo: "tanssi",
};
var tanssi_default = repo3;

// src/lib/configReader.ts
import "@moonbeam-network/api-augment";
import { readFile, access } from "fs/promises";
import { readFileSync, existsSync, constants } from "fs";
import JSONC from "jsonc-parser";
import path, { extname } from "path";

// src/lib/repoDefinitions/index.ts
function standardRepos() {
  const defaultRepos = [moonbeam_default, polkadot_default, tanssi_default];
  return [...defaultRepos];
}

// src/internal/commandParsers.ts
import invariant from "tiny-invariant";
function parseZombieCmd(launchSpec) {
  if (launchSpec) {
    return { cmd: launchSpec.configPath };
  }
  throw new Error(
    `No ZombieSpec found in config. 
 Are you sure your ${chalk.bgWhiteBright.blackBright(
   "moonwall.config.json"
 )} file has the correct "configPath" in zombieSpec?`
  );
}
function fetchDefaultArgs(binName, additionalRepos = []) {
  let defaultArgs;
  const repos = [...standardRepos(), ...additionalRepos];
  for (const repo4 of repos) {
    const foundBin = repo4.binaries.find((bin) => bin.name === binName);
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
var LaunchCommandParser = class _LaunchCommandParser {
  args;
  cmd;
  launch;
  launchSpec;
  additionalRepos;
  launchOverrides;
  constructor(options) {
    const { launchSpec, additionalRepos, launchOverrides } = options;
    this.launchSpec = launchSpec;
    this.additionalRepos = additionalRepos;
    this.launchOverrides = launchOverrides;
    this.launch = !launchSpec.running ? true : launchSpec.running;
    this.cmd = launchSpec.binPath;
    this.args = launchSpec.options
      ? [...launchSpec.options]
      : fetchDefaultArgs(path2.basename(launchSpec.binPath), additionalRepos);
  }
  overrideArg(newArg) {
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
      process.env.MOONWALL_RPC_PORT = freePort;
      if (this.launchSpec.newRpcBehaviour) {
        this.overrideArg(`--rpc-port=${freePort}`);
      } else {
        this.overrideArg(`--ws-port=${freePort}`);
      }
    }
    return this;
  }
  withDefaultForkConfig() {
    const forkOptions = this.launchSpec.defaultForkConfig;
    if (forkOptions) {
      this.applyForkOptions(forkOptions);
    }
    return this;
  }
  withLaunchOverrides() {
    if (this.launchOverrides?.forkConfig) {
      this.applyForkOptions(this.launchOverrides.forkConfig);
    }
    return this;
  }
  print() {
    console.log(chalk.cyan(`Command to run is: ${chalk.bold(this.cmd)}`));
    console.log(chalk.cyan(`Arguments are: ${chalk.bold(this.args.join(" "))}`));
    return this;
  }
  applyForkOptions(forkOptions) {
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
  build() {
    return {
      cmd: this.cmd,
      args: this.args,
      launch: this.launch,
    };
  }
  static async create(options) {
    const parser = new _LaunchCommandParser(options);
    const parsed = await parser
      .withPorts()
      .then((p) => p.withDefaultForkConfig().withLaunchOverrides());
    if (options.verbose) {
      parsed.print();
    }
    return parsed.build();
  }
};
function parseChopsticksRunCmd(launchSpecs) {
  const launch = !launchSpecs[0].running ? true : launchSpecs[0].running;
  if (launchSpecs.length === 1) {
    const chopsticksCmd2 = "node";
    const chopsticksArgs2 = [
      "node_modules/@acala-network/chopsticks/chopsticks.cjs",
      `--config=${launchSpecs[0].configPath}`,
      `--addr=${launchSpecs[0].address ?? "127.0.0.1"}`,
      // use old behaviour by default
    ];
    const mode = launchSpecs[0].buildBlockMode ? launchSpecs[0].buildBlockMode : "manual";
    const num = mode === "batch" ? "Batch" : mode === "instant" ? "Instant" : "Manual";
    chopsticksArgs2.push(`--build-block-mode=${num}`);
    if (launchSpecs[0].wsPort) {
      chopsticksArgs2.push(`--port=${launchSpecs[0].wsPort}`);
    }
    if (launchSpecs[0].wasmOverride) {
      chopsticksArgs2.push(`--wasm-override=${launchSpecs[0].wasmOverride}`);
    }
    if (launchSpecs[0].allowUnresolvedImports) {
      chopsticksArgs2.push("--allow-unresolved-imports");
    }
    return {
      cmd: chopsticksCmd2,
      args: chopsticksArgs2,
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
var isPortAvailable = async (port) => {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once("close", () => resolve(true));
      server.close();
    });
    server.on("error", () => resolve(false));
  });
};
var getNextAvailablePort = async (startPort) => {
  let port = startPort;
  while (port <= 65535) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  throw new Error(`No available ports found starting from ${startPort}`);
};
var getFreePort = async () => {
  let shardIndex = 0;
  let totalShards = 1;
  const testShard = process.env.MOONWALL_TEST_SHARD;
  if (testShard?.includes("/")) {
    const [current, total] = testShard.split("/");
    shardIndex = parseInt(current, 10) - 1;
    totalShards = parseInt(total, 10);
  }
  const poolId = parseInt(process.env.VITEST_POOL_ID || "0", 10);
  const basePort = 1e4;
  const shardOffset = shardIndex * 1e3;
  const poolOffset = poolId * 100;
  const processOffset = process.pid % 50;
  const calculatedPort = basePort + shardOffset + poolOffset + processOffset;
  const startPort = Math.min(calculatedPort, 6e4 + shardIndex * 100 + poolId);
  if (process.env.DEBUG_MOONWALL_PORTS) {
    console.log(
      `[DEBUG] Port calculation: shard=${shardIndex + 1}/${totalShards}, pool=${poolId}, final=${startPort}`
    );
  }
  return getNextAvailablePort(startPort);
};
export { LaunchCommandParser, getFreePort, parseChopsticksRunCmd, parseZombieCmd };
