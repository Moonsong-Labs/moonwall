import "@moonbeam-network/api-augment";
import { Effect } from "effect";
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
import * as Err from "../errors";
import { setTimeout as timer } from "timers/promises";
import { parseChopsticksRunCmd, parseRunCmd, parseZombieCmd } from "../internal/commandParsers";
import {
  IPCRequestMessage,
  IPCResponseMessage,
  checkZombieBins,
  getZombieConfig,
} from "../internal/foundations/zombieHelpers";
import { LaunchedNode, launchNodeEffect } from "../internal/localNode";
import {
  ProviderFactory,
  ProviderInterfaceFactory,
  vitestAutoUrl,
} from "../internal/providerFactories";
import {
  importAsyncConfig,
  importJsonConfig,
  isEthereumDevConfig,
  isEthereumZombieConfig,
  isOptionSet,
} from "./configReader";
const debugSetup = Debug("global:context");

export class MoonwallContext {
  private static instance: MoonwallContext;
  environment!: MoonwallEnvironment;
  providers: ConnectedProvider[];
  nodes: LaunchedNode[];
  foundation: FoundationType;
  zombieNetwork?: Network;
  rtUpgradePath?: string;
  ipcServer?: net.Server;

  private constructor(config: MoonwallConfig) {
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
    };
  }

  private handleChopsticks(env: Environment): IGlobalContextFoundation {
    if (env.foundation.type !== "chopsticks") {
      throw new Error(`Foundation type must be 'chopsticks'`);
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

    const nodeNames = Object.keys(network.nodesByName);
    process.env.MOON_ZOMBIE_DIR = `${network.tmpDir}`;
    process.env.MOON_ZOMBIE_NODES = nodeNames.join("|");

    const onProcessExit = () => {
      try {
        const processIds = Object.values((this.zombieNetwork.client as any).processMap)
          .filter((item) => item!["pid"])
          .map((process) => process!["pid"]);
        execaCommand(`kill ${processIds.join(" ")}`, {
          reject: false,
        });
      } catch (err) {
        // console.log(err.message);
      }
    };

    const socketPath = `${network.tmpDir}/node-ipc.sock`;

    const server = net.createServer((client) => {
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
              const result = await execaCommand(`kill ${pid}`, { timeout: 1000 });
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
        } catch (e) {
          console.log("📨 Error processing message from client:", data.toString());
          console.error(e.message);
          writeToClient({ status: "failure", result: false, message: e.message });
        }
      });
    });

    server.listen(socketPath, () => {
      console.log("📨 IPC Server listening on", socketPath);
    });

    this.ipcServer = server;
    process.env.MOON_IPC_SOCKET = socketPath;

    process.once("SIGINT", onProcessExit);

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

    const promises = nodes.map(async ({ cmd, args, launch }) => {
      if (launch) {
        const result = await Effect.runPromise(launchNodeEffect(cmd, args));
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
          this.providers.push(await ProviderInterfaceFactory.populate(name, type, connect as any));
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
      console.dir(this.getContext(), { depth: 1 });
    } else {
      console.log("Global context not created!");
    }
  }

  public static getContext(force: boolean = false): MoonwallContext {
    if (!MoonwallContext.instance || force) {
      const config = importJsonConfig();
      MoonwallContext.instance = new MoonwallContext(config);
      debugSetup(`🟢  Moonwall context "${config.label}" created`);
    }
    return this.instance;
  }

  public static destroy() {
    if (MoonwallContext.getContext()) {
      return MoonwallContext.getContext().destroyEffect();
    }
  }

  public destroyEffect() {
    return Effect.gen(function* (_) {
      const ctx = MoonwallContext.getContext();
      yield* _(
        Effect.tryPromise({
          try: () => ctx.disconnect(),
          catch: () => new Err.ProviderDisconnectError(),
        })
      );

      if (ctx.nodes.length > 0) {
        const node = ctx.nodes[0];
        // yield* _(Effect.promise(() => execaCommand(`kill ${node.pid}`, { shell: true })));
        yield* _(Effect.try(() => node.kill()));

        for (;;) {
          const isRunning = yield* _(isPidRunningEffect(node.pid));
          if (isRunning) {
            yield* _(Effect.sleep(50));
          } else {
            break;
          }
        }
      }

      if (ctx.zombieNetwork) {
        console.log("🪓  Killing zombie nodes");
        yield* _(
          Effect.tryPromise({
            try: () => ctx.zombieNetwork.stop(),
            catch: () => new Err.ZombieStopError(),
          })
        );

        const processIds = yield* _(
          Effect.filterOrFail(
            Effect.sync(() =>
              Object.values((ctx.zombieNetwork.client as any).processMap)
                .filter((item) => item!["pid"])
                .map((process) => process!["pid"])
            ),
            (pids) => pids.length > 0,
            () => new Err.ZombieStopError()
          )
        );

        yield* _(Effect.sync(() => execaCommandSync(`kill ${processIds.join(" ")}`, {})));
        yield* _(waitForPidsToDieEffect(processIds));

        yield* _(Effect.sync(() => ctx.ipcServer?.close()));
        yield* _(Effect.sync(() => ctx.ipcServer?.removeAllListeners()));
      }
    });
  }
}

export const createContextEffect = () =>
  Effect.gen(function* (_) {
    const ctx = yield* _(Effect.sync(() => MoonwallContext.getContext()));
    yield* _(runNetworkOnlyEffect());
    yield* _(
      Effect.tryPromise({
        try: () => ctx.connectEnvironment(),
        catch: () => new Err.MoonwallContextError(),
      })
    );

    return ctx;
  });

export const runNetworkOnlyEffect = () =>
  Effect.gen(function* (_) {
    const ctx = yield* _(Effect.sync(() => MoonwallContext.getContext()));
    yield* _(
      Effect.tryPromise({
        try: () => ctx.startNetwork(),
        catch: () => new Err.MoonwallContextError(),
      })
    );
  });

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

const isPidRunningEffect = (pid: number) =>
  Effect.gen(function* (_) {
    const result = yield* _(
      Effect.promise(() => execaCommand(`ps -p ${pid} -o pid=`, { cleanup: true, reject: false }))
    );

    if (result.exitCode === 0) {
      return result.stdout.trim() === pid.toString();
    }

    return false;
  });

const waitForPidsToDieEffect = (pids: number[]) =>
  Effect.gen(function* (_) {
    const checkAliveEffect = () => {
      return Effect.allSuccesses(pids.map((pid) => isPidRunningEffect(pid))).pipe(
        Effect.map((res) => res.every((running) => !running))
      );
    };

    while (!(yield* _(checkAliveEffect()))) {
      yield* _(Effect.sleep(1000));
    }
  });
