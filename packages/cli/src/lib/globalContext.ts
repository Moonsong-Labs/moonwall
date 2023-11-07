import "@moonbeam-network/api-augment";
import {
  ConnectedProvider,
  Environment,
  FoundationType,
  MoonwallConfig,
  MoonwallEnvironment,
  MoonwallProvider,
} from "@moonwall/types";
import { ApiPromise } from "@polkadot/api";
import zombie, { Network } from "@zombienet/orchestrator";
import { execaCommand, execaCommandSync } from "execa";
import Debug from "debug";
import fs from "fs";
import net from "net";
import readline from "readline";
import { setTimeout as timer } from "timers/promises";
import { parseChopsticksRunCmd, parseRunCmd, parseZombieCmd } from "../internal/commandParsers";
import {
  IPCRequestMessage,
  IPCResponseMessage,
  checkZombieBins,
  getZombieConfig,
} from "../internal/foundations/zombieHelpers";
import { LaunchedNode, launchNode } from "../internal/localNode";
import {
  ProviderFactory,
  ProviderInterfaceFactory,
  vitestAutoUrl,
} from "../internal/providerFactories";
import {
  importAsyncConfig,
  isEthereumDevConfig,
  isEthereumZombieConfig,
  isOptionSet,
} from "./configReader";
const debugSetup = Debug("global:context");

export class MoonwallContext {
  private static instance: MoonwallContext | undefined;
  environment!: MoonwallEnvironment;
  providers: ConnectedProvider[];
  nodes: LaunchedNode[];
  foundation: FoundationType;
  zombieNetwork?: Network;
  rtUpgradePath?: string;
  ipcServer?: net.Server;

  constructor(config: MoonwallConfig) {
    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;
    this.providers = [];
    this.nodes = [];
    this.foundation = env.foundation.type;

    const foundationHandlers: Record<
      FoundationType,
      (env: Environment, config?: MoonwallConfig) => IGlobalContextFoundation
    > = {
      read_only: this.handleReadOnly,
      chopsticks: this.handleChopsticks,
      dev: this.handleDev,
      zombie: this.handleZombie,
      fork: this.handleReadOnly, // TODO: Implement fork
    };

    const foundationHandler = foundationHandlers[env.foundation.type];
    this.environment = { providers: [], nodes: [], ...foundationHandler.call(this, env, config) };
  }

  private handleZombie(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "zombie") {
      throw new Error(`Foundation type must be 'zombie'`);
    }

    const { cmd: zombieConfig } = parseZombieCmd(env.foundation.zombieSpec);
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
    };
  }

  private handleDev(env: Environment, config: MoonwallConfig): IGlobalContextFoundation {
    if (env.foundation.type !== "dev") {
      throw new Error(`Foundation type must be 'dev'`);
    }

    const { cmd, args, launch } = parseRunCmd(
      env.foundation.launchSpec![0],
      config.additionalRepos
    );
    return {
      name: env.name,
      foundationType: "dev",
      nodes: [
        {
          name: env.foundation.launchSpec![0].name,
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
              endpoints: [vitestAutoUrl],
            },
          ]),
    };
  }

  private handleReadOnly(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "read_only") {
      throw new Error(`Foundation type must be 'dev'`);
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
    };
  }

  private handleChopsticks(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "chopsticks") {
      throw new Error(`Foundation type must be 'dev'`);
    }

    this.rtUpgradePath = env.foundation.rtUpgradePath;
    return {
      name: env.name,
      foundationType: "chopsticks",
      nodes: [parseChopsticksRunCmd(env.foundation.launchSpec!)],
      providers: [...ProviderFactory.prepare(env.connections!)],
    };
  }

  private async startZombieNetwork() {
    const config = await importAsyncConfig();
    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;

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
    if (
      env.foundation.type == "zombie" &&
      env.foundation.zombieSpec.monitoredNode &&
      env.foundation.zombieSpec.monitoredNode in network.nodesByName
    ) {
      process.env.MOON_MONITORED_NODE = `${network.tmpDir}/${env.foundation.zombieSpec.monitoredNode}.log`;
    }
    const nodeNames = Object.keys(network.nodesByName);
    process.env.MOON_ZOMBIE_DIR = `${network.tmpDir}`;
    process.env.MOON_ZOMBIE_NODES = nodeNames.join("|");

    const onProcessExit = () => {
      try {
        const processIds = Object.values((this.zombieNetwork.client as any).processMap)
          .filter((item) => item!["pid"])
          .map((process) => process!["pid"]);
        execaCommandSync(`kill ${processIds.join(" ")}`);
      } catch (err) {
        console.log(err);
        console.log("Failed to kill zombie nodes");
      }
    };

    const socketPath = `${network.tmpDir}/node-ipc.sock`;

    const server = net.createServer((client) => {
      client.on("end", () => {
        console.log("📨 IPC client disconnected");
      });

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

          const node = network.getNodeByName(message.nodeName);

          switch (message.cmd) {
            case "restart": {
              await node.restart();
              await this.disconnect();
              await this.connectEnvironment(true);
              writeToClient({
                status: "success",
                result: true,
                message: `${message.nodeName} restarted`,
              });
              break;
            }

            case "resume": {
              const result = await node.resume();
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} resumed with result ${result}`,
              });
              break;
            }
            case "pause": {
              const result = await node.pause();
              writeToClient({
                status: "success",
                result,
                message: `${message.nodeName} paused with result ${result}`,
              });
              break;
            }
            case "kill": {
              const pid = (network.client as any).processMap[message.nodeName].pid;
              const result = await execaCommand(`kill ${pid}`, { timeout: 1000 });
              writeToClient({
                status: "success",
                result: result.exitCode === 0,
                message: `${message.nodeName}, pid ${pid} killed with exitCode ${result.exitCode}`,
              });
              break;
            }

            case "isup": {
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
        } catch (e) {
          console.log("📨 Message from client:", data.toString());
          writeToClient({ status: "failure", result: false, message: e });
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

    process.env.MOON_MONITORED_NODE = zombieConfig.parachains[0].collator
      ? `${network.tmpDir}/${zombieConfig.parachains[0].collator.name}.log`
      : `${network.tmpDir}/${zombieConfig.parachains[0].collators![0].name}.log`;
    this.zombieNetwork = network;
    return;
  }

  public async startNetwork() {
    if (process.env.MOON_RECYCLE == "true") {
      return MoonwallContext.getContext();
    }

    // const activeNodes = this.nodes.filter((node) => !node.killed);
    if (this.nodes.length > 0) {
      return MoonwallContext.getContext();
    }
    const nodes = MoonwallContext.getContext().environment.nodes;

    if (this.environment.foundationType === "zombie") {
      return await this.startZombieNetwork();
    }

    const promises = nodes.map(async ({ cmd, args, name, launch }) => {
      if (launch) {
        const result = await launchNode(cmd, args, name!);
        this.nodes.push(result);
      } else {
        return Promise.resolve();
      }
    });
    await Promise.allSettled(promises);

    return MoonwallContext.getContext();
  }

  public async connectEnvironment(silent: boolean = false): Promise<MoonwallContext> {
    const config = await importAsyncConfig();
    const env = config.environments.find(({ name }) => name == process.env.MOON_TEST_ENV)!;

    if (this.environment.foundationType == "zombie") {
      this.environment.providers = env.connections
        ? ProviderFactory.prepare(env.connections)
        : isEthereumZombieConfig()
        ? ProviderFactory.prepareDefaultZombie()
        : ProviderFactory.prepareNoEthDefaultZombie();
    }

    if (this.providers.length > 0) {
      return MoonwallContext.getContext();
    }

    const promises = this.environment.providers.map(
      async ({ name, type, connect }) =>
        new Promise(async (resolve) => {
          this.providers.push(await ProviderInterfaceFactory.populate(name, type, connect));
          resolve("");
        })
    );
    await Promise.all(promises);

    if (this.foundation == "zombie") {
      let readStreams: any[];
      if (!isOptionSet("disableLogEavesdropping")) {
        !silent && console.log(`🦻 Eavesdropping on node logs at ${process.env.MOON_ZOMBIE_DIR}`);
        const zombieNodeLogs = process.env
          .MOON_ZOMBIE_NODES!.split("|")
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

      const promises = this.providers
        .filter(({ type }) => type == "polkadotJs")
        .filter(
          ({ name }) =>
            env.foundation.type == "zombie" &&
            (!env.foundation.zombieSpec.skipBlockCheck ||
              !env.foundation.zombieSpec.skipBlockCheck.includes(name))
        )
        .map(async (provider) => {
          return await new Promise(async (resolve) => {
            !silent && console.log(`⏲️  Waiting for chain ${provider.name} to produce blocks...`);
            while (
              (
                await (provider.api as ApiPromise).rpc.chain.getBlock()
              ).block.header.number.toNumber() == 0
            ) {
              await timer(500);
            }
            !silent && console.log(`✅ Chain ${provider.name} producing blocks, continuing`);
            resolve("");
          });
        });

      await Promise.all(promises);

      if (!isOptionSet("disableLogEavesdropping")) {
        readStreams!.forEach((readStream) => readStream.close());
      }
    }

    return MoonwallContext.getContext();
  }

  public async disconnect(providerName?: string) {
    if (providerName) {
      this.providers.find(({ name }) => name === providerName)!.disconnect();
      this.providers.filter(({ name }) => name !== providerName);
    } else {
      await Promise.all(this.providers.map((prov) => prov.disconnect()));
      this.providers = [];
    }
  }

  public static printStats() {
    if (MoonwallContext) {
      console.dir(MoonwallContext.getContext(), { depth: 1 });
    } else {
      console.log("Global context not created!");
    }
  }

  public static getContext(config?: MoonwallConfig, force: boolean = false): MoonwallContext {
    if (!MoonwallContext.instance || force) {
      if (!config) {
        console.error("❌ Config must be provided on Global Context instantiation");
        process.exit(2);
      }
      MoonwallContext.instance = new MoonwallContext(config);

      debugSetup(`🟢  Moonwall context "${config.label}" created`);
    }
    return MoonwallContext.instance;
  }

  public static async destroy() {
    const ctx = this.instance;

    try {
      await ctx.disconnect();
    } catch {
      console.log("🛑  All connections disconnected");
    }

    while (ctx.nodes.length > 0) {
      const node = ctx.nodes.pop();
      const pid = node.pid;
      node.kill("SIGKILL", { forceKillAfterTimeout: 2000 });
      for (;;) {
        if (await isPidRunning(pid)) {
          await timer(10);
        } else {
          break;
        }
      }
    }

    if (ctx.zombieNetwork) {
      console.log("🪓  Killing zombie nodes");
      await ctx.zombieNetwork.stop();
      ctx.ipcServer?.close();
      ctx.ipcServer?.removeAllListeners();
    }
  }
}

export const contextCreator = async () => {
  const config = await importAsyncConfig();
  const ctx = MoonwallContext.getContext(config);
  await runNetworkOnly();
  await ctx.connectEnvironment();
  return ctx;
};

export const runNetworkOnly = async () => {
  const config = await importAsyncConfig();
  const ctx = MoonwallContext.getContext(config);
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

async function isPidRunning(pid: number): Promise<boolean> {
  try {
    await execaCommand(`ps -p ${pid} -o pid=`, { cleanup: true });
    return true;
  } catch {
    return false;
  }
}
