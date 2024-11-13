import "@moonbeam-network/api-augment";
import type {
  ConnectedProvider,
  Environment,
  FoundationType,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
  ProviderType,
} from "@moonwall/types";
import type { ApiPromise } from "@polkadot/api";
import zombie, { type Network } from "@zombienet/orchestrator";
import Debug from "debug";
import fs from "node:fs";
import net from "node:net";
import readline from "node:readline";
import { setTimeout as timer } from "node:timers/promises";
import { parseChopsticksRunCmd, parseRunCmd, parseZombieCmd } from "../internal/commandParsers";
import {
  type IPCRequestMessage,
  type IPCResponseMessage,
  checkZombieBins,
  getZombieConfig,
} from "../internal/foundations/zombieHelpers";
import { launchNode } from "../internal/localNode";
import {
  ProviderFactory,
  ProviderInterfaceFactory,
  vitestAutoUrl,
} from "../internal/providerFactories";
import {
  getEnvironmentFromConfig,
  importAsyncConfig,
  isEthereumDevConfig,
  isEthereumZombieConfig,
  isOptionSet,
} from "./configReader";
import { type ChildProcess, exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { withTimeout } from "../internal";
const debugSetup = Debug("global:context");

export class MoonwallContext {
  private static instance: MoonwallContext | undefined;
  configured = false;
  environment!: MoonwallEnvironment;
  providers: ConnectedProvider[];
  nodes: ChildProcess[];
  foundation: FoundationType;
  zombieNetwork?: Network;
  rtUpgradePath?: string;
  ipcServer?: net.Server;

  constructor(config: MoonwallConfig) {
    const env = config.environments.find(({ name }) => name === process.env.MOON_TEST_ENV);

    if (!env) {
      throw new Error(`Environment ${process.env.MOON_TEST_ENV} not found in config`);
    }

    this.providers = [];
    this.nodes = [];
    this.foundation = env.foundation.type;
  }

  public async setupFoundation() {
    const config = await importAsyncConfig();
    const env = config.environments.find(({ name }) => name === process.env.MOON_TEST_ENV);

    if (!env) {
      throw new Error(`Environment ${process.env.MOON_TEST_ENV} not found in config`);
    }

    const foundationHandlers: Record<
      FoundationType,
      (env: Environment, config: MoonwallConfig) => Promise<IGlobalContextFoundation>
    > = {
      read_only: this.handleReadOnly,
      chopsticks: this.handleChopsticks,
      dev: this.handleDev,
      zombie: this.handleZombie,
      fork: this.handleReadOnly, // TODO: Implement fork
    };

    const foundationHandler = foundationHandlers[env.foundation.type];
    this.environment = {
      providers: [],
      nodes: [],
      ...(await foundationHandler.call(this, env, config)),
    };
    this.configured = true;
  }

  private async handleZombie(env: Environment) {
    if (env.foundation.type !== "zombie") {
      throw new Error(`Foundation type must be 'zombie'`);
    }

    const { cmd: zombieConfig } = await parseZombieCmd(env.foundation.zombieSpec);
    this.rtUpgradePath = env.foundation.rtUpgradePath;
    return {
      name: env.name,
      foundationType: "zombie",
      nodes: [
        {
          name: env.foundation.zombieSpec.name,
          cmd: zombieConfig,
          args: [],
          launch: true,
        },
      ],
    } satisfies IGlobalContextFoundation;
  }

  private async handleDev(env: Environment, config: MoonwallConfig) {
    if (env.foundation.type !== "dev") {
      throw new Error(`Foundation type must be 'dev'`);
    }

    const { cmd, args, launch } = await parseRunCmd(
      env.foundation.launchSpec[0],
      config.additionalRepos
    );

    return {
      name: env.name,
      foundationType: "dev",
      nodes: [
        {
          name: env.foundation.launchSpec[0].name,
          cmd,
          args,
          launch,
        },
      ],
      providers: env.connections
        ? ProviderFactory.prepare(env.connections)
        : isEthereumDevConfig()
          ? ProviderFactory.prepareDefaultDev()
          : ProviderFactory.prepare([
              {
                name: "node",
                type: "polkadotJs",
                endpoints: [vitestAutoUrl()],
              },
            ]),
    } satisfies IGlobalContextFoundation;
  }

  private async handleReadOnly(env: Environment) {
    if (env.foundation.type !== "read_only") {
      throw new Error(`Foundation type must be 'read_only'`);
    }

    if (!env.connections) {
      throw new Error(
        `${env.name} env config is missing connections specification, required by foundation READ_ONLY`
      );
    }
    return {
      name: env.name,
      foundationType: "read_only",
      providers: ProviderFactory.prepare(env.connections),
    } satisfies IGlobalContextFoundation;
  }

  private async handleChopsticks(env: Environment) {
    if (env.foundation.type !== "chopsticks") {
      throw new Error(`Foundation type must be 'chopsticks'`);
    }

    if (!env.connections || env.connections.length === 0) {
      throw new Error(
        `${env.name} env config is missing connections specification, required by foundation CHOPSTICKS`
      );
    }

    this.rtUpgradePath = env.foundation.rtUpgradePath;
    return {
      name: env.name,
      foundationType: "chopsticks",
      nodes: [parseChopsticksRunCmd(env.foundation.launchSpec)],
      providers: [...ProviderFactory.prepare(env.connections)],
    } satisfies IGlobalContextFoundation;
  }

  private async startZombieNetwork() {
    const env = getEnvironmentFromConfig();
    if (env.foundation.type !== "zombie") {
      throw new Error(`Foundation type must be 'zombie', something has gone very wrong.`);
    }

    console.log("🧟 Spawning zombie nodes ...");
    const nodes = this.environment.nodes;

    const zombieConfig = getZombieConfig(nodes[0].cmd);

    await checkZombieBins(zombieConfig);

    const network = await zombie.start("", zombieConfig, { logType: "silent" });
    process.env.MOON_RELAY_WSS = network.relay[0].wsUri;
    process.env.MOON_PARA_WSS = Object.values(network.paras)[0].nodes[0].wsUri;

    const nodeNames = Object.keys(network.nodesByName);
    process.env.MOON_ZOMBIE_DIR = `${network.tmpDir}`;
    process.env.MOON_ZOMBIE_NODES = nodeNames.join("|");

    const onProcessExit = () => {
      try {
        if (!this.zombieNetwork) {
          throw "Zombie network not found to kill";
        }

        const processIds = Object.values((this.zombieNetwork.client as any).processMap)
          .filter((item: any) => item.pid)
          .map((process: any) => process.pid);
        exec(`kill ${processIds.join(" ")}`, (error) => {
          if (error) {
            console.error(`Error killing process: ${error.message}`);
          }
        });
      } catch (err) {
        // console.log(err.message);
      }
    };

    const socketPath = `${network.tmpDir}/node-ipc.sock`;

    const server = net.createServer((client) => {
      // client.on("end", () => {
      //   console.log("📨 IPC client disconnected");
      // });

      // Client message handling
      client.on("data", async (data) => {
        const writeToClient = (message: IPCResponseMessage) => {
          if (client.writable) {
            client.write(JSON.stringify(message));
          } else {
            console.log("Client disconnected, cannot send response.");
          }
        };

        try {
          const message: IPCRequestMessage = JSON.parse(data.toString());

          const zombieClient = network.client;

          if (!message.nodeName) {
            throw new Error("nodeName not provided in message");
          }

          switch (message.cmd) {
            case "networkmap": {
              const result = Object.keys(network.nodesByName);
              writeToClient({
                status: "success",
                result: network.nodesByName,
                message: result.join("|"),
              });
              break;
            }

            case "restart": {
              await this.disconnect();
              await zombieClient.restartNode(message.nodeName, null);
              await timer(1000); // TODO: Replace when zombienet has an appropriate fn
              await this.connectEnvironment(true);
              writeToClient({
                status: "success",
                result: true,
                message: `${message.nodeName} restarted`,
              });
              break;
            }

            case "resume": {
              const node = network.getNodeByName(message.nodeName);
              await this.disconnect();
              const result = await node.resume();
              await (zombieClient as any).wait_node_ready(message.nodeName);
              await this.connectEnvironment(true);
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} resumed with result ${result}`,
              });
              break;
            }

            case "pause": {
              const node = network.getNodeByName(message.nodeName);
              await this.disconnect();
              const result = await node.pause();
              await timer(1000); // TODO: Replace when zombienet has an appropriate fn
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} paused with result ${result}`,
              });
              break;
            }

            case "kill": {
              // await this.disconnect();
              const pid = (network.client as any).processMap[message.nodeName].pid;
              delete (network.client as any).processMap[message.nodeName];
              const result = exec(`kill ${pid}`, { timeout: 1000 });
              // await this.connectEnvironment(true);
              writeToClient({
                status: "success",
                result: result.exitCode === 0,
                message: `${message.nodeName}, pid ${pid} killed with exitCode ${result.exitCode}`,
              });
              break;
            }

            case "isup": {
              const node = network.getNodeByName(message.nodeName);
              const result = await node.isUp();
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} isUp result is ${result}`,
              });
              break;
            }

            default:
              throw new Error(`Invalid command received: ${message.cmd}`);
          }
        } catch (e: any) {
          console.log("📨 Error processing message from client:", data.toString());
          console.error(e.message);
          writeToClient({
            status: "failure",
            result: false,
            message: e.message,
          });
        }
      });
    });

    server.listen(socketPath, () => {
      console.log("📨 IPC Server listening on", socketPath);
    });

    this.ipcServer = server;
    process.env.MOON_IPC_SOCKET = socketPath;

    process.once("exit", onProcessExit);
    process.once("SIGINT", onProcessExit);

    this.zombieNetwork = network;
    return;
  }

  public async startNetwork() {
    const ctx = await MoonwallContext.getContext();

    if (process.env.MOON_RECYCLE === "true") {
      return ctx;
    }

    if (this.nodes.length > 0) {
      return ctx;
    }

    const nodes = ctx.environment.nodes;

    if (this.environment.foundationType === "zombie") {
      return await this.startZombieNetwork();
    }

    const maxStartupTimeout = 30000; // 30 seconds

    await withTimeout(
      Promise.all(
        nodes.map(async ({ cmd, args, name, launch }) => {
          if (launch) {
            try {
              const { runningNode } = await launchNode(cmd, args, name || "node");
              this.nodes.push(runningNode);
              debugSetup(`✅ Node '${name || "unnamed"}' started with PID ${runningNode.pid}`);
            } catch (error: any) {
              throw new Error(`Failed to start node '${name || "unnamed"}': ${error.message}`);
            }
          }
        })
      ),
      maxStartupTimeout
    );
    debugSetup("✅ All network nodes started successfully.");

    return ctx;
  }

  public async connectEnvironment(silent = false): Promise<MoonwallContext> {
    const env = getEnvironmentFromConfig();

    if (this.environment.foundationType === "zombie") {
      this.environment.providers = env.connections
        ? ProviderFactory.prepare(env.connections)
        : isEthereumZombieConfig()
          ? ProviderFactory.prepareDefaultZombie()
          : ProviderFactory.prepareNoEthDefaultZombie();
    }

    if (this.providers.length > 0) {
      return MoonwallContext.getContext();
    }

    const maxRetries = 15;
    const retryDelay = 1000; // 1 second
    const connectTimeout = 10000; // 10 seconds per attempt

    const connectWithRetry = async (provider: {
      name: string;
      type: ProviderType;
      connect: any;
    }) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          debugSetup(`🔄 Connecting provider ${provider.name}, attempt ${attempt}`);

          const connectedProvider = await Promise.race([
            ProviderInterfaceFactory.populate(provider.name, provider.type, provider.connect),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Connection attempt timed out")), connectTimeout)
            ),
          ]);

          this.providers.push(connectedProvider);
          debugSetup(`✅ Provider ${provider.name} connected on attempt ${attempt}`);
          return;
        } catch (error: any) {
          console.error(
            `❌ Error connecting provider ${provider.name} on attempt ${attempt}: ${error.message}`
          );

          if (attempt === maxRetries) {
            throw new Error(
              `Failed to connect provider '${provider.name}' after ${maxRetries} attempts: ${error.message}`
            );
          }

          debugSetup(
            `⚠️  Retrying provider ${provider.name} connection, attempt ${attempt + 1}/${maxRetries}`
          );
          await timer(retryDelay);
        }
      }
    };

    try {
      await Promise.all(this.environment.providers.map(connectWithRetry));
    } catch (error: any) {
      console.error(`Error connecting to environment: ${error.message}`);
      console.error("Current providers:", this.providers.map((p) => p.name).join(", "));
      console.error(`Total providers: ${this.environment.providers.map((p) => p.name).join(", ")}`);
      throw error;
    }

    if (this.foundation === "zombie") {
      await this.handleZombiePostConnection(silent, env);
    }

    return MoonwallContext.getContext();
  }

  private async handleZombiePostConnection(silent: boolean, env: Environment) {
    let readStreams: fs.ReadStream[] = [];

    if (!isOptionSet("disableLogEavesdropping")) {
      !silent && console.log(`🦻 Eavesdropping on node logs at ${process.env.MOON_ZOMBIE_DIR}`);

      const envVar = process.env.MOON_ZOMBIE_NODES;

      if (!envVar) {
        throw new Error("MOON_ZOMBIE_NODES not set, this is an error please raise.");
      }

      const zombieNodeLogs = envVar
        .split("|")
        .map((nodeName) => `${process.env.MOON_ZOMBIE_DIR}/${nodeName}.log`);

      readStreams = zombieNodeLogs.map((logPath) => {
        const readStream = fs.createReadStream(logPath, { encoding: "utf8" });
        const lineReader = readline.createInterface({
          input: readStream,
        });

        lineReader.on("line", (line) => {
          if (line.includes("WARN") || line.includes("ERROR")) {
            console.log(line);
          }
        });

        return readStream;
      });
    }

    const polkadotJsProviders = this.providers
      .filter(({ type }) => type === "polkadotJs")
      .filter(
        ({ name }) =>
          env.foundation.type === "zombie" &&
          (!env.foundation.zombieSpec.skipBlockCheck ||
            !env.foundation.zombieSpec.skipBlockCheck.includes(name))
      );

    await Promise.all(
      polkadotJsProviders.map(async (provider) => {
        !silent && console.log(`⏲️  Waiting for chain ${provider.name} to produce blocks...`);
        while (
          (
            await (provider.api as ApiPromise).rpc.chain.getBlock()
          ).block.header.number.toNumber() === 0
        ) {
          await timer(500);
        }
        !silent && console.log(`✅ Chain ${provider.name} producing blocks, continuing`);
      })
    );

    if (!isOptionSet("disableLogEavesdropping")) {
      for (const readStream of readStreams) {
        readStream.close();
      }
    }
  }

  public async disconnect(providerName?: string) {
    if (providerName) {
      const prov = this.providers.find(({ name }) => name === providerName);

      if (!prov) {
        throw new Error(`Provider ${providerName} not found`);
      }

      try {
        await prov.disconnect();
        debugSetup(`✅ Provider ${providerName} disconnected`);
      } catch (error: any) {
        console.error(`❌ Error disconnecting provider ${providerName}: ${error.message}`);
      }
    } else {
      await Promise.all(
        this.providers.map(async (prov) => {
          try {
            await prov.disconnect();
            debugSetup(`✅ Provider ${prov.name} disconnected`);
          } catch (error: any) {
            console.error(`❌ Error disconnecting provider ${prov.name}: ${error.message}`);
          }
        })
      );
      this.providers = [];
    }
  }

  public static async getContext(config?: MoonwallConfig, force = false): Promise<MoonwallContext> {
    if (!MoonwallContext.instance?.configured || force) {
      if (!config) {
        throw new Error("❌ Config must be provided on Global Context instantiation");
      }
      MoonwallContext.instance = new MoonwallContext(config);
      await MoonwallContext.instance.setupFoundation();
      debugSetup(`🟢  Moonwall context "${config.label}" created`);
    }
    return MoonwallContext.instance;
  }

  public static async destroy() {
    const ctx = MoonwallContext.instance;

    if (!ctx) {
      throw new Error("❌  No context to destroy");
    }

    try {
      await ctx.disconnect();
    } catch {
      console.log("🛑  All connections disconnected");
    }

    while (ctx.nodes.length > 0) {
      const node = ctx.nodes.pop();

      if (!node) {
        throw new Error("❌  No nodes to destroy");
      }

      const pid = node.pid;

      if (!pid) {
        throw new Error("❌  No pid to destroy");
      }

      node.kill("SIGINT");
      for (;;) {
        const isRunning = await isPidRunning(pid);
        if (isRunning) {
          await timer(10);
        } else {
          break;
        }
      }
    }

    if (ctx.zombieNetwork) {
      console.log("🪓  Killing zombie nodes");
      await ctx.zombieNetwork.stop();
      const processIds = Object.values((ctx.zombieNetwork.client as any).processMap)
        .filter((item: any) => item.pid)
        .map((process: any) => process.pid);

      try {
        execSync(`kill ${processIds.join(" ")}`, {});
      } catch (e: any) {
        console.log(e.message);
        console.log("continuing...");
      }

      await waitForPidsToDie(processIds);

      ctx.ipcServer?.close();
      ctx.ipcServer?.removeAllListeners();
    }
  }
}

export const contextCreator = async () => {
  const config = await importAsyncConfig();
  const ctx = await MoonwallContext.getContext(config);
  await runNetworkOnly();
  await ctx.connectEnvironment();
  return ctx;
};

export const runNetworkOnly = async () => {
  const config = await importAsyncConfig();
  const ctx = await MoonwallContext.getContext(config);
  await ctx.startNetwork();
};

export interface IGlobalContextFoundation {
  name: string;
  context?: object;
  providers?: MoonwallProvider[];
  nodes?: {
    name?: string;
    cmd: string;
    args: string[];
    launch: boolean;
  }[];
  foundationType: FoundationType;
}

const execAsync = promisify(exec);

async function isPidRunning(pid: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`ps -p ${pid} -o pid=`);
    return stdout.trim() === pid.toString();
  } catch (error) {
    return false;
  }
}

async function waitForPidsToDie(pids: number[]): Promise<void> {
  const checkPids = async (): Promise<boolean> => {
    const checks = pids.map(async (pid) => await isPidRunning(pid));
    const results = await Promise.all(checks);
    return results.every((running) => !running);
  };

  while (!(await checkPids())) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
