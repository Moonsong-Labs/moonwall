import { exec, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";
import { checkAccess, checkExists } from "./fileCheckers";
import { createLogger } from "@moonwall/util";
import { setTimeout as timer } from "node:timers/promises";
import util from "node:util";
import type { DevLaunchSpec } from "@moonwall/types";
import Docker from "dockerode";
import invariant from "tiny-invariant";

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
      if (await checkWebSocketJSONRPC(Number.parseInt(rpcPort))) {
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

  runningNode.once("exit", () => {
    fsStream.end();
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
            await checkWebSocketJSONRPC(port);
            break probe;
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
    exec(`ps -p ${pid} -o pid=`, (error, stdout, stderr) => {
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
    const ws = new WebSocket(`ws://localhost:${port}`);

    const result: boolean = await new Promise((resolve) => {
      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "system_chain",
            params: [],
          })
        );
      });

      ws.on("message", (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.jsonrpc === "2.0" && response.id === 1) {
            resolve(true);
          } else {
            resolve(false);
          }
        } catch (e) {
          resolve(false);
        }
      });

      ws.on("error", () => {
        resolve(false);
      });
    });

    ws?.close();
    return result;
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
