import { LaunchConfig } from "@zombienet/orchestrator";
import chalk from "chalk";
import fs from "node:fs";
import { checkAccess, checkExists } from "../fileCheckers";
import { setTimeout as timer } from "timers/promises";
import net from "net";

export async function checkZombieBins(config: LaunchConfig) {
  const relayBinPath = config.relaychain.default_command;

  if (!relayBinPath) {
    throw new Error("No relayBinPath '[relaychain.default_command]' specified in zombie config");
  }
  await checkExists(relayBinPath);
  checkAccess(relayBinPath);

  const promises = config.parachains.map((para) => {
    if (para.collator) {
      if (!para.collator.command) {
        throw new Error(
          "No command found for collator, please check your zombienet config file for collator command"
        );
      }
      checkExists(para.collator.command);
      checkAccess(para.collator.command);
    }

    if (para.collators) {
      for (const coll of para.collators) {
        if (!coll.command) {
          throw new Error(
            "No command found for collators, please check your zombienet config file for collators command"
          );
        }
        checkExists(coll.command);
        checkAccess(coll.command);
      }
      // para.collators.forEach((coll) => {
      //   if (!coll.command) {
      //     throw new Error(
      //       "No command found for collators, please check your zombienet config file for para collators command"
      //     );
      //   }
      //   checkExists(coll.command);
      //   checkAccess(coll.command);
      // });
    }
  });
  await Promise.all(promises);
}

export function getZombieConfig(path: string) {
  const fsResult = fs.existsSync(path);
  if (!fsResult) {
    throw new Error(
      `No ZombieConfig file found at location: ${path} \n Are you sure your ${chalk.bgWhiteBright.blackBright(
        "moonwall.config.json"
      )} file has the correct "configPath" in zombieSpec?`
    );
  }

  const buffer = fs.readFileSync(path, "utf-8");
  return JSON.parse(buffer) as LaunchConfig;
}

export type IPCRequestMessage = {
  text: string;
  cmd: "restart" | "pause" | "resume" | "kill" | "isup" | "init" | "networkmap";
  nodeName?: string;
};

export type IPCResponseMessage = {
  status: "success" | "failure";
  result: boolean | object;
  message: string;
};

export async function sendIpcMessage(message: IPCRequestMessage): Promise<IPCResponseMessage> {
  return new Promise(async (resolve, reject) => {
    let response: IPCResponseMessage;
    const ipcPath = process.env.MOON_IPC_SOCKET;

    if (!ipcPath) {
      throw new Error("No IPC path found. This is a bug, please report it.");
    }

    const client = net.createConnection({ path: ipcPath });

    // Listener to return control flow after server responds
    client.on("data", async (data) => {
      response = JSON.parse(data.toString());
      if (response.status === "success") {
        client.end();

        for (let i = 0; ; i++) {
          if (client.closed) {
            break;
          }

          if (i > 100) {
            reject(new Error(`Closing IPC connection failed`));
          }
          await timer(200);
        }
        resolve(response);
      }

      if (response.status === "failure") {
        reject(new Error(JSON.stringify(response)));
      }
    });

    for (let i = 0; ; i++) {
      if (!client.connecting) {
        break;
      }

      if (i > 100) {
        reject(new Error(`Connection to ${ipcPath} failed`));
      }
      await timer(200);
    }

    await new Promise((resolve) => {
      client.write(JSON.stringify(message), () => resolve("Sent!"));
    });
  });
}
