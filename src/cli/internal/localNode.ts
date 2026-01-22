import type { DevLaunchSpec } from "../../types/index.js";
import { createLogger } from "../../util/index.js";
import Docker from "dockerode";
import { exec, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as timer } from "node:timers/promises";
import util from "node:util";
import invariant from "tiny-invariant";
import WebSocket from "ws";
import { isEthereumDevConfig, isEthereumZombieConfig } from "../lib/configReader.js";
import { checkAccess, checkExists } from "./fileCheckers.js";
import type { MoonwallProcess } from "./node.js";

const execAsync = util.promisify(exec);
const logger = createLogger({ name: "localNode" });
const debug = logger.debug.bind(logger);

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

export async function launchNodeLegacy(options: {
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

  const port = args.find((a) => a.includes("port"))?.split("=")[1];
  debug(`\x1b[36mStarting ${name} node on port ${port}...\x1b[0m`);

  const dirPath = path.join(process.cwd(), "tmp", "node_logs");

  const runningNode = spawn(cmd, args);

  const logLocation = path
    .join(
      dirPath,
      `${path.basename(cmd)}_node_${args.find((a) => a.includes("port"))?.split("=")[1]}_${
        runningNode.pid
      }.log`
    )
    .replaceAll("node_node_undefined", "chopsticks");

  process.env.MOON_LOG_LOCATION = logLocation;

  const fsStream = fs.createWriteStream(logLocation);

  runningNode.on("error", (err) => {
    if ((err as any).errno === "ENOENT") {
      console.error(`\x1b[31mMissing Local binary at(${cmd}).\nPlease compile the project\x1b[0m`);
    }
    throw new Error(err.message);
  });

  const logHandler = (chunk: any) => {
    if (fsStream.writable) {
      fsStream.write(chunk, (err) => {
        if (err) console.error(err);
        else fsStream.emit("drain");
      });
    }
  };

  runningNode.stderr?.on("data", logHandler);
  runningNode.stdout?.on("data", logHandler);

  runningNode.once("exit", (code, signal) => {
    const timestamp = new Date().toISOString();
    let message: string;

    // Check if this termination was initiated by Moonwall
    const moonwallNode = runningNode as MoonwallProcess;

    if (moonwallNode.isMoonwallTerminating) {
      message = `${timestamp} [moonwall] process killed. reason: ${moonwallNode.moonwallTerminationReason || "unknown"}`;
    } else if (code !== null) {
      message = `${timestamp} [moonwall] process exited with status code ${code}`;
    } else if (signal !== null) {
      message = `${timestamp} [moonwall] process terminated by signal ${signal}`;
    } else {
      message = `${timestamp} [moonwall] process terminated unexpectedly`;
    }

    // Write the message before closing the stream
    if (fsStream.writable) {
      fsStream.write(`${message}\n`, (err) => {
        if (err) console.error(`Failed to write exit message to log: ${err}`);
        fsStream.end();
      });
    } else {
      // Fallback: append to file directly if stream is not writable
      try {
        fs.appendFileSync(logLocation, `${message}\n`);
      } catch (err) {
        console.error(`Failed to append exit message to log file: ${err}`);
      }
      fsStream.end();
    }

    runningNode.stderr?.removeListener("data", logHandler);
    runningNode.stdout?.removeListener("data", logHandler);
  });

  if (!runningNode.pid) {
    const errorMessage = "Failed to start child process";
    console.error(errorMessage);
    fs.appendFileSync(logLocation, `${errorMessage}\n`);
    throw new Error(errorMessage);
  }

  // Check if the process exited immediately
  if (runningNode.exitCode !== null) {
    const errorMessage = `Child process exited immediately with code ${runningNode.exitCode}`;
    console.error(errorMessage);
    fs.appendFileSync(logLocation, `${errorMessage}\n`);
    throw new Error(errorMessage);
  }

  const isRunning = await isPidRunning(runningNode.pid);

  if (!isRunning) {
    const errorMessage = `Process with PID ${runningNode.pid} is not running`;
    spawnSync(cmd, args, { stdio: "inherit" });
    throw new Error(errorMessage);
  }

  probe: for (let i = 0; ; i++) {
    try {
      const ports = await findPortsByPid(runningNode.pid);
      if (ports) {
        for (const port of ports) {
          try {
            const isReady = await checkWebSocketJSONRPC(port);
            if (isReady) {
              break probe;
            }
          } catch {}
        }
      }
    } catch {
      if (i === 300) {
        throw new Error("Could not find ports for node after 30 seconds");
      }
      await timer(100);
      continue;
    }
    await timer(100);
  }

  return { runningNode, fsStream };
}

function isPidRunning(pid: number): Promise<boolean> {
  return new Promise((resolve) => {
    exec(`ps -p ${pid} -o pid=`, (error, stdout, _stderr) => {
      if (error) {
        resolve(false);
      } else {
        resolve(stdout.trim() !== "");
      }
    });
  });
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
          } catch (_e) {
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
        } catch (_e) {
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
      } catch (_e) {
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
    } catch (_e) {
      // HTTP service not ready yet
      return false;
    }
  } catch {
    return false;
  }
}

async function findPortsByPid(pid: number, retryCount = 600, retryDelay = 100): Promise<number[]> {
  for (let i = 0; i < retryCount; i++) {
    try {
      const { stdout } = await execAsync(`lsof -p ${pid} -n -P | grep LISTEN`);
      const ports: number[] = [];
      const lines = stdout.split("\n");
      for (const line of lines) {
        // Example outputs:
        // - lsof node      97796 romarq   26u  IPv6 0xb6c3e894a2247189      0t0  TCP *:8000 (LISTEN)
        // - lsof node      97242 romarq   26u  IPv6 0x330c461cca8d2b63      0t0  TCP [::1]:8000 (LISTEN)
        const regex = /(?:.+):(\d+)/;
        const match = line.match(regex);
        if (match) {
          ports.push(Number(match[1]));
        }
      }

      if (ports.length) {
        return ports;
      }
      throw new Error("Could not find any ports");
    } catch (error) {
      if (i === retryCount - 1) {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, retryDelay));
  }

  return [];
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
