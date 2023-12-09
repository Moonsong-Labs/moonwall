import { Config, Effect } from "effect";
import net from "net";
import { importMoonwallConfig } from "../lib/configReader";
import path from "path";
// Define as a forked resource

/// Use acquire use release

// HTTP Server example: https://github.com/mikearnaldi/sf-meetup/blob/main/src/lib/http.ts

// Effect.forever,
// Effect.interruptible,
// Effect.forkScoped

// Use message queues: https://effect.website/docs/concurrency/queue

export type NodePoolRequest = {
  text?: string;
  id: number; // Should be the Fiber ID or UUID
  cmd: "provision" | "release" | "query" | "ping";
};

export type NodePoolResponse = {
  status: "success" | "failure";
  result: boolean | ProvisionedNode;
  message: string;
};

export type ProvisionedNode = {
  id: number;
  nodeName: string;
  port: number;
  pid: number;
};

export const setIpcSocketPath = (socketPath?: string) => {
  const pathToSocket = socketPath ?? path.join(process.cwd(), "tmp", "nodepool-ipc.sock");
  process.env.MOON_NODEPOOL_SOCKET = pathToSocket;
  return pathToSocket;
};

export const nodePool = (socketPath: string) =>
  Effect.gen(function* (_) {
    const config = yield* _(importMoonwallConfig());
    const selectedEnv = yield* _(Effect.config(Config.string("MOON_TEST_ENV")));
    const env = config.environments.find(({ name }) => name == selectedEnv)!;

    const nodesToStart =
      typeof env.multiThreads === "number" ? env.multiThreads : env.multiThreads === true ? 4 : 1;

    yield* _(Effect.logInfo(`Starting node pool with ${nodesToStart} nodes`));

    const server = yield* _(
      Effect.acquireRelease(
        // Acquire
        Effect.sync(() =>
          net.createServer((server) => {
            server.on("data", async (data) => {
              const writeToClient = (message: NodePoolResponse) => {
                if (server.writable) {
                  server.write(JSON.stringify(message));
                } else {
                  console.log("Client disconnected, cannot send response.");
                }
              };

              const request = JSON.parse(data.toString()) as NodePoolRequest;
              console.log(`Received message from client: ${JSON.stringify(request)}`);

              switch (request.cmd) {
                case "ping": {
                  writeToClient({ status: "success", result: true, message: "pong" });
                  break;
                }

                case "provision": {
                  // const node = yield* _(provisionNode(env));
                  const node = true;
                  writeToClient({ status: "success", result: node, message: "Node provisioned" });
                  break;
                }

                case "release": {
                  // const node = yield* _(releaseNode(request.id));
                  const node = true;
                  writeToClient({ status: "success", result: node, message: "Node released" });
                  break;
                }

                case "query": {
                  // const node = yield* _(queryNode(request.id));
                  const node = true;
                  writeToClient({ status: "success", result: node, message: "Node queried" });
                  break;
                }

                default:
                  writeToClient({
                    status: "failure",
                    result: true,
                    message: `Invalid command "${request.cmd}" received`,
                  });
                  break;
              }
            });
          })
        ),
        //Release
        (server) =>
          Effect.async<never, never, void>((resume) => {
            server.close((err) => {
              if (err) {
                resume(Effect.die(err));
              } else {
                resume(Effect.logInfo("Server closed"));
              }
            });
          })
      )
    );

    yield* _(
      Effect.async<never, never, void>((resume) => {
        server.listen(socketPath, () => resume(Effect.unit));
      })
    );

    yield* _(Effect.logDebug(`Node pool listening on ${socketPath}`));
  });

export const nodePoolClientSend = (message: NodePoolRequest, socketPath: string) =>
  Effect.gen(function* (_) {
    const client = yield* _(
      Effect.acquireRelease(
        // Acquire
        Effect.sync(() => net.createConnection({ path: socketPath })),
        // Release
        (client) =>
          Effect.async<never, never, void>((resume) => {
            client.end(() => {
              resume(Effect.logInfo("Client closed"));
            });
          })
      )
    );

    yield* _(Effect.sync(() => client.write(JSON.stringify(message))));
    yield* _(Effect.logInfo(`Sent message to node pool: ${JSON.stringify(message)}`));
    return yield* _(
      Effect.async<never, NodePoolResponse | string, NodePoolResponse>((resume) => {
        client.on("data", (data) => {
          const resp = JSON.parse(data.toString()) as NodePoolResponse;

          switch (resp.status) {
            case "success": {
              resume(Effect.succeed(resp));
              break;
            }

            case "failure": {
              resume(Effect.fail(resp));
              break;
            }

            default: {
              resume(Effect.fail(`Invalid response status: ${resp.status}`));
              break;
            }
          }
        });
      })
    );
  });

// export async function sendIpcMessage(message: IPCRequestMessage): Promise<IPCResponseMessage> {
//   return new Promise(async (resolve, reject) => {
//     let response: IPCResponseMessage;
//     const ipcPath = process.env.MOON_IPC_SOCKET;
//     const client = net.createConnection({ path: ipcPath });

//     // Listener to return control flow after server responds
//     client.on("data", async (data) => {
//       response = JSON.parse(data.toString());
//       if (response.status === "success") {
//         client.end();

//         for (let i = 0; ; i++) {
//           if (client.closed) {
//             break;
//           }

//           if (i > 100) {
//             reject(new Error(`Closing IPC connection failed`));
//           }
//           await timer(200);
//         }
//         resolve(response);
//       }

//       if (response.status === "failure") {
//         reject(new Error(JSON.stringify(response)));
//       }
//     });

//     for (let i = 0; ; i++) {
//       if (!client.connecting) {
//         break;
//       }

//       if (i > 100) {
//         reject(new Error(`Connection to ${ipcPath} failed`));
//       }
//       await timer(200);
//     }

//     await new Promise((resolve) => {
//       client.write(JSON.stringify(message), () => resolve("Sent!"));
//     });
//   });
// }

// export const serve2r = net.createServer((client) => {
//   client.on("data", async (data) => {
//     const writeToClient = (message: IPCResponseMessage) => {
//       if (client.writable) {
//         client.write(JSON.stringify(message));
//       } else {
//         console.log("Client disconnected, cannot send response.");
//       }
//     };

//     try {
//       const message: IPCRequestMessage = JSON.parse(data.toString());

//       const zombieClient = network.client;

//       switch (message.cmd) {
//         case "networkmap": {
//           const result = Object.keys(network.nodesByName);
//           writeToClient({
//             status: "success",
//             result: network.nodesByName,
//             message: result.join("|"),
//           });
//           break;
//         }

//         case "restart": {
//           await this.disconnect();
//           await zombieClient.restartNode(message.nodeName, null);
//           await timer(1000); // TODO: Replace when zombienet has an appropriate fn
//           await this.connectEnvironment(true);
//           writeToClient({
//             status: "success",
//             result: true,
//             message: `${message.nodeName} restarted`,
//           });
//           break;
//         }

//         case "resume": {
//           const node = network.getNodeByName(message.nodeName);
//           await this.disconnect();
//           const result = await node.resume();
//           await (zombieClient as any).wait_node_ready(message.nodeName);
//           await this.connectEnvironment(true);
//           writeToClient({
//             status: "success",
//             result,
//             message: `${message.nodeName} resumed with result ${result}`,
//           });
//           break;
//         }

//         case "pause": {
//           const node = network.getNodeByName(message.nodeName);
//           await this.disconnect();
//           const result = await node.pause();
//           await timer(1000); // TODO: Replace when zombienet has an appropriate fn
//           writeToClient({
//             status: "success",
//             result,
//             message: `${message.nodeName} paused with result ${result}`,
//           });
//           break;
//         }

//         case "kill": {
//           // await this.disconnect();
//           const pid = (network.client as any).processMap[message.nodeName].pid;
//           delete (network.client as any).processMap[message.nodeName];
//           const processIds = Object.values((this.zombieNetwork.client as any).processMap)
//             .filter((item) => item!["pid"])
//             .map((process) => process!["pid"]);

//           const command = Command.make(`kill ${processIds.join(" ")}`).pipe(
//             Command.runInShell("/bin/bash")
//           );

//           await Effect.runPromiseExit(
//             Effect.provide(Command.string(command), LocalEnvironment) as any
//           );
//           // const result = await execaCommand(`kill ${pid}`, { timeout: 1000 });
//           // await this.connectEnvironment(true);
//           writeToClient({
//             status: "success",
//             result: true, //result.exitCode === 0,
//             message: `${message.nodeName}, pid ${pid} killed`,
//           });
//           break;
//         }

//         case "isup": {
//           const node = network.getNodeByName(message.nodeName);
//           const result = await node.isUp();
//           writeToClient({
//             status: "success",
//             result,
//             message: `${message.nodeName} isUp result is ${result}`,
//           });
//           break;
//         }

//         default:
//           throw new Error(`Invalid command received: ${message.cmd}`);
//       }
//     } catch (e: any) {
//       console.log("📨 Error processing message from client:", data.toString());
//       console.error(e.message);
//       writeToClient({ status: "failure", result: false, message: e.message });
//     }
//   });
// });
