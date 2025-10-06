import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";
import { checkAccess, checkExists } from "./fileCheckers";
import { createLogger } from "@moonwall/util";
import { setTimeout as timer } from "node:timers/promises";
import type { DevLaunchSpec } from "@moonwall/types";
import Docker from "dockerode";
import invariant from "tiny-invariant";
import { isEthereumDevConfig, isEthereumZombieConfig } from "../lib/configReader";
import { launchNodeEffect } from "./effect";

const logger = createLogger({ name: "node" });
const debug = logger.debug.bind(logger);

/**
 * Extended ChildProcess interface with Moonwall termination tracking
 */
export interface MoonwallProcess extends ChildProcess {
  /**
   * Flag indicating if this process is being terminated by Moonwall
   */
  isMoonwallTerminating?: boolean;

  /**
   * Reason for Moonwall-initiated termination
   */
  moonwallTerminationReason?: string;

  /**
   * Effect-based cleanup function for automatic resource management
   */
  effectCleanup?: () => Promise<void>;
}

// TODO: Add multi-threading support
async function launchDockerContainer(
  imageName: string,
  args: string[],
  name: string,
  dockerConfig?: DevLaunchSpec["dockerConfig"]
) {
  const docker = new Docker();
  const port = args.find((a) => a.includes("port"))?.split("=")[1];
  debug(`\x1b[36mStarting Docker container ${imageName} on port ${port}...\x1b[0m`);

  const dirPath = path.join(process.cwd(), "tmp", "node_logs");
  const logLocation = path.join(dirPath, `${name}_docker_${Date.now()}.log`);
  const fsStream = fs.createWriteStream(logLocation);
  process.env.MOON_LOG_LOCATION = logLocation;

  const portBindings = dockerConfig?.exposePorts?.reduce<Record<string, { HostPort: string }[]>>(
    (acc, { hostPort, internalPort }) => {
      acc[`${internalPort}/tcp`] = [{ HostPort: hostPort.toString() }];
      return acc;
    },
    {}
  );

  const rpcPort = args.find((a) => a.includes("rpc-port"))?.split("=")[1];
  invariant(rpcPort, "RPC port not found, this is a bug");

  const containerOptions = {
    Image: imageName,
    platform: "linux/amd64",
    Cmd: args,
    name: dockerConfig?.containerName || `moonwall_${name}_${Date.now()}`,
    ExposedPorts: {
      ...Object.fromEntries(
        dockerConfig?.exposePorts?.map(({ internalPort }) => [`${internalPort}/tcp`, {}]) || []
      ),
      [`${rpcPort}/tcp`]: {},
    },
    HostConfig: {
      PortBindings: {
        ...portBindings,
        [`${rpcPort}/tcp`]: [{ HostPort: rpcPort }],
      },
    },
    Env: dockerConfig?.runArgs?.filter((arg) => arg.startsWith("env:")).map((arg) => arg.slice(4)),
  } satisfies Docker.ContainerCreateOptions;

  try {
    await pullImage(imageName, docker);

    const container = await docker.createContainer(containerOptions);
    await container.start();

    const containerInfo = await container.inspect();
    if (!containerInfo.State.Running) {
      const errorMessage = `Container failed to start: ${containerInfo.State.Error}`;
      console.error(errorMessage);
      fs.appendFileSync(logLocation, `${errorMessage}\n`);
      throw new Error(errorMessage);
    }

    for (let i = 0; i < 300; i++) {
      const isReady = await checkWebSocketJSONRPC(Number.parseInt(rpcPort, 10));
      if (isReady) {
        break;
      }
      await timer(100);
    }

    return { runningNode: container, fsStream };
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`Docker container launch failed: ${error.message}`);
      fs.appendFileSync(logLocation, `Docker launch error: ${error.message}\n`);
    }
    throw error;
  }
}

export async function launchNode(options: {
  command: string;
  args: string[];
  name: string;
  launchSpec?: DevLaunchSpec;
}) {
  const { command: cmd, args, name, launchSpec: config } = options;

  if (config?.useDocker) {
    return launchDockerContainer(cmd, args, name, config.dockerConfig);
  }

  if (cmd.includes("moonbeam")) {
    await checkExists(cmd);
    checkAccess(cmd);
  }

  // Determine if this is an Ethereum chain based on args
  const isEthereumChain = args.some(
    (arg) => arg.includes("--ethapi") || arg.includes("--eth-rpc") || arg.includes("--enable-evm")
  );

  const { result, cleanup } = await launchNodeEffect({
    command: cmd,
    args,
    name,
    launchSpec: config,
    isEthereumChain,
  });

  logger.debug(
    `✅ Node '${name}' started with PID ${result.runningNode.pid} on port ${result.port}`
  );
  process.env.MOON_LOG_LOCATION = result.logPath;

  // CRITICAL: Set MOONWALL_RPC_PORT and WSS_URL so tests can connect
  process.env.MOONWALL_RPC_PORT = result.port.toString();
  process.env.WSS_URL = `ws://127.0.0.1:${result.port}`;
  debug(`Set MOONWALL_RPC_PORT=${result.port}, WSS_URL=${process.env.WSS_URL}`);

  // Store cleanup function for later teardown
  const moonwallNode = result.runningNode as MoonwallProcess;
  moonwallNode.effectCleanup = cleanup;

  return { runningNode: moonwallNode };
}

async function checkWebSocketJSONRPC(port: number): Promise<boolean> {
  try {
    // Determine if this is an Ethereum-compatible chain from config
    const isEthereumChain = isEthereumDevConfig() || isEthereumZombieConfig();

    // First check WebSocket availability
    const ws = new WebSocket(`ws://localhost:${port}`);

    const checkWsMethod = async (method: string): Promise<boolean> => {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          resolve(false);
        }, 5000);

        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 10000),
            method,
            params: [],
          })
        );

        const messageHandler = (data: any) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.jsonrpc === "2.0" && !response.error) {
              clearTimeout(timeout);
              ws.removeListener("message", messageHandler);
              resolve(true);
            }
          } catch (_error) {
            // Ignore parse errors
          }
        };

        ws.on("message", messageHandler);
      });
    };

    const wsResult: boolean = await new Promise<boolean>((resolve) => {
      ws.on("open", async () => {
        try {
          // Check system_chain first via WebSocket (works for all chains)
          const systemChainAvailable = await checkWsMethod("system_chain");
          if (!systemChainAvailable) {
            resolve(false);
            return;
          }

          // For Ethereum-compatible chains, also check eth_chainId via WebSocket
          if (isEthereumChain) {
            const ethChainIdAvailable = await checkWsMethod("eth_chainId");
            if (!ethChainIdAvailable) {
              resolve(false);
              return;
            }
          }

          // WebSocket checks passed
          resolve(true);
        } catch (_error) {
          resolve(false);
        }
      });

      ws.on("error", () => {
        resolve(false);
      });
    });

    ws?.close();

    if (!wsResult) {
      return false;
    }

    // Now also check HTTP service is ready
    const httpUrl = `http://localhost:${port}`;

    const checkHttpMethod = async (method: string): Promise<boolean> => {
      try {
        const response = await fetch(httpUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: Math.floor(Math.random() * 10000),
            method,
            params: [],
          }),
        });

        if (!response.ok) {
          return false;
        }

        const data: any = await response.json();
        return !data.error;
      } catch (_error) {
        return false;
      }
    };

    try {
      // Always check system_chain via HTTP (works for all chains)
      const systemChainAvailable = await checkHttpMethod("system_chain");
      if (!systemChainAvailable) {
        return false;
      }

      // For Ethereum chains, also verify eth_chainId is available via HTTP
      if (isEthereumChain) {
        const ethChainIdAvailable = await checkHttpMethod("eth_chainId");
        return ethChainIdAvailable;
      }

      // For non-Ethereum chains, system_chain being available is enough
      return true;
    } catch (_error) {
      // HTTP service not ready yet
      return false;
    }
  } catch {
    return false;
  }
}

async function pullImage(imageName: string, docker: Docker) {
  console.log(`Pulling Docker image: ${imageName}`);

  const pullStream = await docker.pull(imageName);
  // Dockerode pull doesn't wait for completion by default 🫠
  await new Promise((resolve, reject) => {
    docker.modem.followProgress(pullStream, (err: Error | null, output: any[]) => {
      if (err) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  });
}
